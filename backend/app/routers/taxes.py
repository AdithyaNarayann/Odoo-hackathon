from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import NotFoundException
from app.models.catalog import Product, TaxRule
from app.schemas.catalog import TaxResolveResponse, TaxRuleCreate, TaxRuleResponse, TaxRuleUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/taxes",
    tags=["Tax Rules"],
)

WHITELISTED_SORT_COLUMNS = {
    "id": TaxRule.id,
    "name": TaxRule.name,
    "rate": TaxRule.rate,
    "scope": TaxRule.scope,
    "is_active": TaxRule.is_active,
    "created_at": TaxRule.created_at,
}


def resolve_product_tax(product: Product, db: Session) -> TaxResolveResponse:
    """
    Tax resolution logic: product beats product_type beats all.
    """
    # 1. Product-level rule
    rule = (
        db.query(TaxRule)
        .filter(
            TaxRule.scope == "product",
            TaxRule.scope_value == str(product.id),
            TaxRule.is_active == True,
        )
        .order_by(TaxRule.id.desc())
        .first()
    )
    if rule:
        return TaxResolveResponse(
            product_id=product.id,
            product_name=product.name,
            applicable_rule_id=rule.id,
            applicable_rule_name=rule.name,
            scope=rule.scope,
            rate=rule.rate,
        )

    # 2. Product-type level rule
    rule = (
        db.query(TaxRule)
        .filter(
            TaxRule.scope == "product_type",
            TaxRule.scope_value == product.type,
            TaxRule.is_active == True,
        )
        .order_by(TaxRule.id.desc())
        .first()
    )
    if rule:
        return TaxResolveResponse(
            product_id=product.id,
            product_name=product.name,
            applicable_rule_id=rule.id,
            applicable_rule_name=rule.name,
            scope=rule.scope,
            rate=rule.rate,
        )

    # 3. Global "all" rule
    rule = (
        db.query(TaxRule)
        .filter(
            TaxRule.scope == "all",
            TaxRule.is_active == True,
        )
        .order_by(TaxRule.id.desc())
        .first()
    )
    if rule:
        return TaxResolveResponse(
            product_id=product.id,
            product_name=product.name,
            applicable_rule_id=rule.id,
            applicable_rule_name=rule.name,
            scope=rule.scope,
            rate=rule.rate,
        )

    # Default: 0 rate if no rules configured
    return TaxResolveResponse(
        product_id=product.id,
        product_name=product.name,
        applicable_rule_id=None,
        applicable_rule_name=None,
        scope=None,
        rate=0,
    )


@router.get("", response_model=PaginatedResponse[TaxRuleResponse], summary="List tax rules")
def list_tax_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    query = db.query(TaxRule)

    if is_active is not None:
        query = query.filter(TaxRule.is_active == is_active)

    if scope:
        query = query.filter(TaxRule.scope == scope)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(TaxRule.name.ilike(search_filter))

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, TaxRule.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[TaxRuleResponse](
        items=[TaxRuleResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/resolve/{product_id}", response_model=TaxResolveResponse, summary="Resolve effective tax rule for a product")
def resolve_tax(
    product_id: int,
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise NotFoundException(detail="Product not found", code="PRODUCT_NOT_FOUND")

    return resolve_product_tax(product, db)


@router.get("/{id}", response_model=TaxRuleResponse, summary="Get tax rule details")
def get_tax_rule(
    id: int,
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    rule = db.query(TaxRule).filter(TaxRule.id == id).first()
    if not rule:
        raise NotFoundException(detail="Tax rule not found", code="TAX_RULE_NOT_FOUND")
    return TaxRuleResponse.model_validate(rule)


@router.post("", response_model=TaxRuleResponse, status_code=status.HTTP_201_CREATED, summary="Create a tax rule")
def create_tax_rule(
    payload: TaxRuleCreate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = TaxRule(
        name=payload.name.strip(),
        rate=payload.rate,
        scope=payload.scope,
        scope_value=payload.scope_value.strip() if payload.scope_value else None,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return TaxRuleResponse.model_validate(rule)


@router.put("/{id}", response_model=TaxRuleResponse, summary="Update tax rule")
def update_tax_rule(
    id: int,
    payload: TaxRuleUpdate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(TaxRule).filter(TaxRule.id == id).first()
    if not rule:
        raise NotFoundException(detail="Tax rule not found", code="TAX_RULE_NOT_FOUND")

    if payload.name is not None:
        rule.name = payload.name.strip()
    if payload.rate is not None:
        rule.rate = payload.rate
    if payload.scope is not None:
        rule.scope = payload.scope
    if payload.scope_value is not None:
        rule.scope_value = payload.scope_value.strip() if payload.scope_value else None
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    db.commit()
    db.refresh(rule)
    return TaxRuleResponse.model_validate(rule)


@router.delete("/{id}", response_model=TaxRuleResponse, summary="Soft delete tax rule")
def delete_tax_rule(
    id: int,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(TaxRule).filter(TaxRule.id == id).first()
    if not rule:
        raise NotFoundException(detail="Tax rule not found", code="TAX_RULE_NOT_FOUND")

    rule.is_active = False
    db.commit()
    db.refresh(rule)
    return TaxRuleResponse.model_validate(rule)
