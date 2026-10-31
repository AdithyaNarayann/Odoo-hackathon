from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import BadRequestException, NotFoundException
from app.models.catalog import Plan, Product, ProductVariant, QuotationTemplate, QuotationTemplateLine
from app.schemas.catalog import (
    QuotationTemplateCreate,
    QuotationTemplateLineResponse,
    QuotationTemplateResponse,
    QuotationTemplateUpdate,
)
from app.schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/quotation-templates",
    tags=["Quotation Templates"],
    dependencies=[Depends(require_roles("admin", "staff"))],
)

WHITELISTED_SORT_COLUMNS = {
    "id": QuotationTemplate.id,
    "name": QuotationTemplate.name,
    "plan_id": QuotationTemplate.plan_id,
    "validity_days": QuotationTemplate.validity_days,
    "is_active": QuotationTemplate.is_active,
    "created_at": QuotationTemplate.created_at,
}


def build_template_response(template: QuotationTemplate) -> QuotationTemplateResponse:
    lines = []
    for line in template.lines:
        variant_label = f"{line.variant.attribute}: {line.variant.value}" if line.variant else None
        extra = line.variant.extra_price if line.variant else 0
        unit_price = (line.product.sales_price if line.product else 0) + extra

        lines.append(
            QuotationTemplateLineResponse(
                id=line.id,
                product_id=line.product_id,
                product_name=line.product.name if line.product else "",
                variant_id=line.variant_id,
                variant_label=variant_label,
                quantity=line.quantity,
                unit_price=unit_price,
            )
        )

    return QuotationTemplateResponse(
        id=template.id,
        name=template.name,
        plan_id=template.plan_id,
        plan_name=template.plan.name if template.plan else "",
        validity_days=template.validity_days,
        is_active=template.is_active,
        lines=lines,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.get("", response_model=PaginatedResponse[QuotationTemplateResponse], summary="List quotation templates")
def list_quotation_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    db: Session = Depends(get_db),
):
    query = (
        db.query(QuotationTemplate)
        .options(
            joinedload(QuotationTemplate.plan),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.product),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.variant),
        )
    )

    if is_active is not None:
        query = query.filter(QuotationTemplate.is_active == is_active)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(QuotationTemplate.name.ilike(search_filter))

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, QuotationTemplate.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[QuotationTemplateResponse](
        items=[build_template_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=QuotationTemplateResponse, summary="Get quotation template details")
def get_quotation_template(id: int, db: Session = Depends(get_db)):
    template = (
        db.query(QuotationTemplate)
        .options(
            joinedload(QuotationTemplate.plan),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.product),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.variant),
        )
        .filter(QuotationTemplate.id == id)
        .first()
    )
    if not template:
        raise NotFoundException(detail="Quotation template not found", code="TEMPLATE_NOT_FOUND")
    return build_template_response(template)


@router.post("", response_model=QuotationTemplateResponse, status_code=status.HTTP_201_CREATED, summary="Create quotation template")
def create_quotation_template(payload: QuotationTemplateCreate, db: Session = Depends(get_db)):
    # Verify plan exists
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise BadRequestException(detail=f"Plan with id {payload.plan_id} not found", code="PLAN_NOT_FOUND")

    template = QuotationTemplate(
        name=payload.name.strip(),
        plan_id=payload.plan_id,
        validity_days=payload.validity_days,
        is_active=payload.is_active,
    )
    db.add(template)
    db.flush()

    for line_data in payload.lines:
        # Validate product
        prod = db.query(Product).filter(Product.id == line_data.product_id).first()
        if not prod:
            raise BadRequestException(detail=f"Product with id {line_data.product_id} not found", code="PRODUCT_NOT_FOUND")

        # Validate variant if specified
        if line_data.variant_id is not None:
            var = db.query(ProductVariant).filter(
                ProductVariant.id == line_data.variant_id,
                ProductVariant.product_id == line_data.product_id,
            ).first()
            if not var:
                raise BadRequestException(
                    detail=f"Variant {line_data.variant_id} does not belong to product {line_data.product_id}",
                    code="INVALID_VARIANT",
                )

        t_line = QuotationTemplateLine(
            template_id=template.id,
            product_id=line_data.product_id,
            variant_id=line_data.variant_id,
            quantity=line_data.quantity,
        )
        db.add(t_line)

    db.commit()

    # Re-fetch with joined relations
    created = (
        db.query(QuotationTemplate)
        .options(
            joinedload(QuotationTemplate.plan),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.product),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.variant),
        )
        .filter(QuotationTemplate.id == template.id)
        .first()
    )
    return build_template_response(created)


@router.put("/{id}", response_model=QuotationTemplateResponse, summary="Update quotation template")
def update_quotation_template(id: int, payload: QuotationTemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(QuotationTemplate).filter(QuotationTemplate.id == id).first()
    if not template:
        raise NotFoundException(detail="Quotation template not found", code="TEMPLATE_NOT_FOUND")

    if payload.name is not None:
        template.name = payload.name.strip()

    if payload.plan_id is not None:
        plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
        if not plan:
            raise BadRequestException(detail=f"Plan with id {payload.plan_id} not found", code="PLAN_NOT_FOUND")
        template.plan_id = payload.plan_id

    if payload.validity_days is not None:
        template.validity_days = payload.validity_days

    if payload.is_active is not None:
        template.is_active = payload.is_active

    if payload.lines is not None:
        # Replace existing lines
        db.query(QuotationTemplateLine).filter(QuotationTemplateLine.template_id == template.id).delete()
        for line_data in payload.lines:
            prod = db.query(Product).filter(Product.id == line_data.product_id).first()
            if not prod:
                raise BadRequestException(detail=f"Product with id {line_data.product_id} not found", code="PRODUCT_NOT_FOUND")
            if line_data.variant_id is not None:
                var = db.query(ProductVariant).filter(
                    ProductVariant.id == line_data.variant_id,
                    ProductVariant.product_id == line_data.product_id,
                ).first()
                if not var:
                    raise BadRequestException(detail=f"Variant {line_data.variant_id} does not belong to product {line_data.product_id}", code="INVALID_VARIANT")
            t_line = QuotationTemplateLine(
                template_id=template.id,
                product_id=line_data.product_id,
                variant_id=line_data.variant_id,
                quantity=line_data.quantity,
            )
            db.add(t_line)

    db.commit()

    updated = (
        db.query(QuotationTemplate)
        .options(
            joinedload(QuotationTemplate.plan),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.product),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.variant),
        )
        .filter(QuotationTemplate.id == template.id)
        .first()
    )
    return build_template_response(updated)


@router.delete("/{id}", response_model=QuotationTemplateResponse, summary="Soft delete quotation template")
def delete_quotation_template(id: int, db: Session = Depends(get_db)):
    template = db.query(QuotationTemplate).filter(QuotationTemplate.id == id).first()
    if not template:
        raise NotFoundException(detail="Quotation template not found", code="TEMPLATE_NOT_FOUND")

    template.is_active = False
    db.commit()

    deleted = (
        db.query(QuotationTemplate)
        .options(
            joinedload(QuotationTemplate.plan),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.product),
            joinedload(QuotationTemplate.lines).joinedload(QuotationTemplateLine.variant),
        )
        .filter(QuotationTemplate.id == template.id)
        .first()
    )
    return build_template_response(deleted)
