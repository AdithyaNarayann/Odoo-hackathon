from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import ConflictException, NotFoundException
from app.models.catalog import Product, ProductVariant
from app.schemas.catalog import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
    ProductVariantUpdate,
)
from app.schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/products",
    tags=["Products & Variants"],
)

WHITELISTED_SORT_COLUMNS = {
    "id": Product.id,
    "name": Product.name,
    "type": Product.type,
    "sales_price": Product.sales_price,
    "cost_price": Product.cost_price,
    "is_active": Product.is_active,
    "created_at": Product.created_at,
}


def build_product_response(product: Product) -> ProductResponse:
    variants = [
        ProductVariantResponse(
            id=v.id,
            product_id=v.product_id,
            attribute=v.attribute,
            value=v.value,
            extra_price=v.extra_price,
            effective_price=product.sales_price + v.extra_price,
        )
        for v in (product.variants or [])
    ]
    return ProductResponse(
        id=product.id,
        name=product.name,
        type=product.type,
        sales_price=product.sales_price,
        cost_price=product.cost_price,
        notes=product.notes,
        is_active=product.is_active,
        variants=variants,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


# Read endpoints: Admin and Staff allowed
@router.get("", response_model=PaginatedResponse[ProductResponse], summary="List products")
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    query = db.query(Product).options(joinedload(Product.variants))

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if type:
        query = query.filter(Product.type == type)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_filter),
                Product.notes.ilike(search_filter),
            )
        )

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, Product.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[ProductResponse](
        items=[build_product_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=ProductResponse, summary="Get product details")
def get_product(
    id: int,
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .options(joinedload(Product.variants))
        .filter(Product.id == id)
        .first()
    )
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")
    return build_product_response(product)


# Write endpoints: Admin only
@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create a product")
def create_product(
    payload: ProductCreate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    product = Product(
        name=payload.name.strip(),
        type=payload.type,
        sales_price=payload.sales_price,
        cost_price=payload.cost_price,
        notes=payload.notes.strip() if payload.notes else None,
        is_active=payload.is_active,
    )
    db.add(product)
    db.flush()

    if payload.variants:
        for v in payload.variants:
            variant = ProductVariant(
                product_id=product.id,
                attribute=v.attribute.strip(),
                value=v.value.strip(),
                extra_price=v.extra_price,
            )
            db.add(variant)

    db.commit()
    db.refresh(product)
    return build_product_response(product)


@router.put("/{id}", response_model=ProductResponse, summary="Update product details")
def update_product(
    id: int,
    payload: ProductUpdate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).options(joinedload(Product.variants)).filter(Product.id == id).first()
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.type is not None:
        product.type = payload.type
    if payload.sales_price is not None:
        product.sales_price = payload.sales_price
    if payload.cost_price is not None:
        product.cost_price = payload.cost_price
    if payload.notes is not None:
        product.notes = payload.notes.strip() if payload.notes else None
    if payload.is_active is not None:
        product.is_active = payload.is_active

    db.commit()
    db.refresh(product)
    return build_product_response(product)


@router.delete("/{id}", response_model=ProductResponse, summary="Soft delete a product")
def delete_product(
    id: int,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).options(joinedload(Product.variants)).filter(Product.id == id).first()
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")

    product.is_active = False
    db.commit()
    db.refresh(product)
    return build_product_response(product)


# Variant sub-endpoints (Admin only)
@router.post("/{id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED, summary="Add variant to product")
def add_product_variant(
    id: int,
    payload: ProductVariantCreate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")

    # Check for duplicate attribute & value
    dup = (
        db.query(ProductVariant)
        .filter(
            ProductVariant.product_id == id,
            ProductVariant.attribute == payload.attribute.strip(),
            ProductVariant.value == payload.value.strip(),
        )
        .first()
    )
    if dup:
        raise ConflictException(
            detail=f"Variant with attribute '{payload.attribute}' and value '{payload.value}' already exists for this product.",
            code="VARIANT_ALREADY_EXISTS",
        )

    variant = ProductVariant(
        product_id=id,
        attribute=payload.attribute.strip(),
        value=payload.value.strip(),
        extra_price=payload.extra_price,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)

    return ProductVariantResponse(
        id=variant.id,
        product_id=variant.product_id,
        attribute=variant.attribute,
        value=variant.value,
        extra_price=variant.extra_price,
        effective_price=product.sales_price + variant.extra_price,
    )


@router.put("/{id}/variants/{variant_id}", response_model=ProductVariantResponse, summary="Update product variant")
def update_product_variant(
    id: int,
    variant_id: int,
    payload: ProductVariantUpdate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")

    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id, ProductVariant.product_id == id).first()
    if not variant:
        raise NotFoundException(detail="Product variant not found", code="VARIANT_NOT_FOUND")

    if payload.attribute is not None:
        variant.attribute = payload.attribute.strip()
    if payload.value is not None:
        variant.value = payload.value.strip()
    if payload.extra_price is not None:
        variant.extra_price = payload.extra_price

    db.commit()
    db.refresh(variant)

    return ProductVariantResponse(
        id=variant.id,
        product_id=variant.product_id,
        attribute=variant.attribute,
        value=variant.value,
        extra_price=variant.extra_price,
        effective_price=product.sales_price + variant.extra_price,
    )


@router.delete("/{id}/variants/{variant_id}", response_model=ProductVariantResponse, summary="Delete product variant")
def delete_product_variant(
    id: int,
    variant_id: int,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")

    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id, ProductVariant.product_id == id).first()
    if not variant:
        raise NotFoundException(detail="Product variant not found", code="VARIANT_NOT_FOUND")

    resp = ProductVariantResponse(
        id=variant.id,
        product_id=variant.product_id,
        attribute=variant.attribute,
        value=variant.value,
        extra_price=variant.extra_price,
        effective_price=product.sales_price + variant.extra_price,
    )

    db.delete(variant)
    db.commit()
    return resp
