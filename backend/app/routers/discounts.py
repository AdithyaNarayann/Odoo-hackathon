from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import BadRequestException, NotFoundException
from app.models.catalog import DiscountRule, Product
from app.schemas.catalog import DiscountRuleCreate, DiscountRuleResponse, DiscountRuleUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/discounts",
    tags=["Discount Rules"],
)

WHITELISTED_SORT_COLUMNS = {
    "id": DiscountRule.id,
    "name": DiscountRule.name,
    "type": DiscountRule.type,
    "value": DiscountRule.value,
    "start_date": DiscountRule.start_date,
    "end_date": DiscountRule.end_date,
    "is_active": DiscountRule.is_active,
    "created_at": DiscountRule.created_at,
}


def build_discount_response(rule: DiscountRule) -> DiscountRuleResponse:
    product_ids = [p.id for p in rule.products]
    return DiscountRuleResponse(
        id=rule.id,
        name=rule.name,
        type=rule.type,
        value=rule.value,
        min_purchase_amount=rule.min_purchase_amount,
        min_quantity=rule.min_quantity,
        start_date=rule.start_date,
        end_date=rule.end_date,
        usage_limit=rule.usage_limit,
        used_count=rule.used_count,
        applies_to=rule.applies_to,
        product_ids=product_ids,
        is_active=rule.is_active,
        status=rule.compute_status(),
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.get("", response_model=PaginatedResponse[DiscountRuleResponse], summary="List discount rules")
def list_discounts(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    query = db.query(DiscountRule).options(joinedload(DiscountRule.products))

    if is_active is not None:
        query = query.filter(DiscountRule.is_active == is_active)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(DiscountRule.name.ilike(search_filter))

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, DiscountRule.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    all_rules = query.all()
    # Filter by computed status if requested
    if status_filter:
        all_rules = [r for r in all_rules if r.compute_status() == status_filter.lower()]

    total = len(all_rules)
    start = (page - 1) * page_size
    items = all_rules[start : start + page_size]

    return PaginatedResponse[DiscountRuleResponse](
        items=[build_discount_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=DiscountRuleResponse, summary="Get discount rule details")
def get_discount(
    id: int,
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    rule = db.query(DiscountRule).options(joinedload(DiscountRule.products)).filter(DiscountRule.id == id).first()
    if not rule:
        raise NotFoundException(detail="Discount rule not found", code="DISCOUNT_NOT_FOUND")
    return build_discount_response(rule)


@router.post("", response_model=DiscountRuleResponse, status_code=status.HTTP_201_CREATED, summary="Create a discount rule")
def create_discount(
    payload: DiscountRuleCreate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = DiscountRule(
        name=payload.name.strip(),
        type=payload.type,
        value=payload.value,
        min_purchase_amount=payload.min_purchase_amount,
        min_quantity=payload.min_quantity,
        start_date=payload.start_date,
        end_date=payload.end_date,
        usage_limit=payload.usage_limit,
        used_count=0,
        applies_to=payload.applies_to,
        is_active=payload.is_active,
    )

    if payload.applies_to == "products" and payload.product_ids:
        products = db.query(Product).filter(Product.id.in_(payload.product_ids)).all()
        if len(products) != len(payload.product_ids):
            raise BadRequestException(detail="One or more specified product_ids are invalid", code="INVALID_PRODUCT_IDS")
        rule.products = products

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return build_discount_response(rule)


@router.put("/{id}", response_model=DiscountRuleResponse, summary="Update discount rule")
def update_discount(
    id: int,
    payload: DiscountRuleUpdate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(DiscountRule).options(joinedload(DiscountRule.products)).filter(DiscountRule.id == id).first()
    if not rule:
        raise NotFoundException(detail="Discount rule not found", code="DISCOUNT_NOT_FOUND")

    if payload.name is not None:
        rule.name = payload.name.strip()
    if payload.type is not None:
        rule.type = payload.type
    if payload.value is not None:
        rule.value = payload.value
    if payload.min_purchase_amount is not None:
        rule.min_purchase_amount = payload.min_purchase_amount
    if payload.min_quantity is not None:
        rule.min_quantity = payload.min_quantity
    if payload.start_date is not None:
        rule.start_date = payload.start_date
    if payload.end_date is not None:
        rule.end_date = payload.end_date
    if payload.usage_limit is not None:
        rule.usage_limit = payload.usage_limit
    if payload.applies_to is not None:
        rule.applies_to = payload.applies_to
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    if payload.product_ids is not None:
        products = db.query(Product).filter(Product.id.in_(payload.product_ids)).all()
        if len(products) != len(payload.product_ids):
            raise BadRequestException(detail="One or more specified product_ids are invalid", code="INVALID_PRODUCT_IDS")
        rule.products = products

    db.commit()
    db.refresh(rule)
    return build_discount_response(rule)


@router.delete("/{id}", response_model=DiscountRuleResponse, summary="Deactivate / soft delete discount rule")
def delete_discount(
    id: int,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(DiscountRule).options(joinedload(DiscountRule.products)).filter(DiscountRule.id == id).first()
    if not rule:
        raise NotFoundException(detail="Discount rule not found", code="DISCOUNT_NOT_FOUND")

    rule.is_active = False
    db.commit()
    db.refresh(rule)
    return build_discount_response(rule)
