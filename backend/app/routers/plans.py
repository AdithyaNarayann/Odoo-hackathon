from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import NotFoundException
from app.models.catalog import Plan
from app.schemas.catalog import PlanCreate, PlanResponse, PlanUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(
    prefix="/api/plans",
    tags=["Subscription Plans"],
)

WHITELISTED_SORT_COLUMNS = {
    "id": Plan.id,
    "name": Plan.name,
    "price": Plan.price,
    "billing_period": Plan.billing_period,
    "min_quantity": Plan.min_quantity,
    "available_from": Plan.available_from,
    "available_to": Plan.available_to,
    "is_active": Plan.is_active,
    "created_at": Plan.created_at,
}


@router.get("", response_model=PaginatedResponse[PlanResponse], summary="List subscription plans")
def list_plans(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    billing_period: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    query = db.query(Plan)

    if is_active is not None:
        query = query.filter(Plan.is_active == is_active)

    if billing_period:
        query = query.filter(Plan.billing_period == billing_period)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(Plan.name.ilike(search_filter))

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, Plan.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[PlanResponse](
        items=[PlanResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=PlanResponse, summary="Get subscription plan details")
def get_plan(
    id: int,
    user=Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == id).first()
    if not plan:
        raise NotFoundException(detail="Subscription plan not found", code="PLAN_NOT_FOUND")
    return PlanResponse.model_validate(plan)


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED, summary="Create a subscription plan")
def create_plan(
    payload: PlanCreate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    plan = Plan(
        name=payload.name.strip(),
        price=payload.price,
        billing_period=payload.billing_period,
        min_quantity=payload.min_quantity,
        available_from=payload.available_from,
        available_to=payload.available_to,
        auto_close=payload.auto_close,
        closable=payload.closable,
        pausable=payload.pausable,
        renewable=payload.renewable,
        is_active=payload.is_active,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)


@router.put("/{id}", response_model=PlanResponse, summary="Update subscription plan")
def update_plan(
    id: int,
    payload: PlanUpdate,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == id).first()
    if not plan:
        raise NotFoundException(detail="Subscription plan not found", code="PLAN_NOT_FOUND")

    if payload.name is not None:
        plan.name = payload.name.strip()
    if payload.price is not None:
        plan.price = payload.price
    if payload.billing_period is not None:
        plan.billing_period = payload.billing_period
    if payload.min_quantity is not None:
        plan.min_quantity = payload.min_quantity
    if payload.available_from is not None:
        plan.available_from = payload.available_from
    if payload.available_to is not None:
        plan.available_to = payload.available_to
    if payload.auto_close is not None:
        plan.auto_close = payload.auto_close
    if payload.closable is not None:
        plan.closable = payload.closable
    if payload.pausable is not None:
        plan.pausable = payload.pausable
    if payload.renewable is not None:
        plan.renewable = payload.renewable
    if payload.is_active is not None:
        plan.is_active = payload.is_active

    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)


@router.delete("/{id}", response_model=PlanResponse, summary="Soft delete subscription plan")
def delete_plan(
    id: int,
    user=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == id).first()
    if not plan:
        raise NotFoundException(detail="Subscription plan not found", code="PLAN_NOT_FOUND")

    plan.is_active = False
    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)
