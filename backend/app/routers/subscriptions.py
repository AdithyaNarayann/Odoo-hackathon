from datetime import date, datetime, timedelta
from typing import Optional
import pytz
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.errors import ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException
from app.models.catalog import Product, QuotationTemplate
from app.models.customer import Customer
from app.models.subscription import Subscription, SubscriptionEvent, SubscriptionLine
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.invoice import InvoiceLinePreviewResponse, InvoicePreviewResponse
from app.schemas.subscription import (
    RenewSubscriptionRequest,
    SubscriptionBoardColumn,
    SubscriptionBoardResponse,
    SubscriptionCardResponse,
    SubscriptionCreate,
    SubscriptionCreateFromTemplate,
    SubscriptionLineCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.billing_period import compute_period_bounds, get_billing_period_relativedelta, get_payment_terms_days
from app.services.pricing import calculate_pricing
from app.services.state_machine import (
    pause_subscription,
    resume_subscription,
    renew_subscription,
    transition_subscription_status,
)
from app.services.subscription import (
    add_subscription_line,
    build_subscription_response,
    create_subscription,
    create_subscription_from_template,
)

router = APIRouter(
    prefix="/api/subscriptions",
    tags=["Subscriptions"],
)

WHITELISTED_SORT_COLUMNS = {
    "id": Subscription.id,
    "number": Subscription.number,
    "start_date": Subscription.start_date,
    "expiry_date": Subscription.expiry_date,
    "status": Subscription.status,
    "next_billing_date": Subscription.next_billing_date,
    "recurring_subtotal": Subscription.recurring_subtotal,
    "created_at": Subscription.created_at,
}


def get_current_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


class ToggleAddOnRequest(BaseModel):
    enabled: bool


@router.get("", response_model=PaginatedResponse[SubscriptionResponse], summary="List subscriptions with filters")
def list_subscriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    customer: Optional[int] = Query(None, description="Filter by customer ID"),
    plan: Optional[int] = Query(None, description="Filter by plan ID"),
    is_paused: Optional[bool] = Query(None),
    expiring_within_days: Optional[int] = Query(None, ge=0),
    q: Optional[str] = Query(None, description="Search by number or customer/company name"),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Subscription)
        .join(Subscription.customer)
        .options(
            joinedload(Subscription.customer),
            joinedload(Subscription.plan),
            joinedload(Subscription.lines).joinedload(SubscriptionLine.product),
            joinedload(Subscription.lines).joinedload(SubscriptionLine.variant),
            joinedload(Subscription.events),
        )
    )

    # Customer isolation & Draft restriction
    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust:
            return PaginatedResponse[SubscriptionResponse](items=[], total=0, page=page, page_size=page_size)
        query = query.filter(Subscription.customer_id == cust.id, Subscription.status != "draft")
    else:
        if customer:
            query = query.filter(Subscription.customer_id == customer)

    if status:
        query = query.filter(Subscription.status == status.lower())

    if plan:
        query = query.filter(Subscription.plan_id == plan)

    if is_paused is not None:
        query = query.filter(Subscription.is_paused == is_paused)

    if expiring_within_days is not None:
        today = get_current_today()
        target = today + timedelta(days=expiring_within_days)
        query = query.filter(Subscription.expiry_date >= today, Subscription.expiry_date <= target)

    if q:
        search_filter = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                Subscription.number.ilike(search_filter),
                Customer.name.ilike(search_filter),
                Customer.company_name.ilike(search_filter),
            )
        )

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, Subscription.id)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[SubscriptionResponse](
        items=[build_subscription_response(item, db) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/board", response_model=SubscriptionBoardResponse, summary="Get subscription Kanban board overview")
def get_subscription_board(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(Subscription).join(Subscription.customer).join(Subscription.plan)

    is_cust = current_user.role == "customer"
    cust_id = None
    if is_cust:
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        cust_id = cust.id if cust else -1
        base_query = base_query.filter(Subscription.customer_id == cust_id)

    columns: dict = {}
    statuses = ["draft", "quotation", "confirmed", "active", "closed"]

    for st in statuses:
        if is_cust and st == "draft":
            # Customers never see Draft subscriptions
            columns[st] = SubscriptionBoardColumn(total_count=0, cards=[])
            continue

        q_st = base_query.filter(Subscription.status == st)
        total = q_st.count()
        recent = q_st.order_by(Subscription.id.desc()).limit(20).all()

        cards = [
            SubscriptionCardResponse(
                id=s.id,
                number=s.number,
                customer_name=s.customer.name,
                company_name=s.customer.company_name,
                plan_name=s.plan.name,
                status=s.status,
                recurring_subtotal=s.recurring_subtotal,
                start_date=s.start_date,
                expiry_date=s.expiry_date,
                next_billing_date=s.next_billing_date,
                is_paused=s.is_paused,
            )
            for s in recent
        ]
        columns[st] = SubscriptionBoardColumn(total_count=total, cards=cards)

    return SubscriptionBoardResponse(
        draft=columns["draft"],
        quotation=columns["quotation"],
        confirmed=columns["confirmed"],
        active=columns["active"],
        closed=columns["closed"],
    )


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED, summary="Create subscription")
def create_new_subscription(
    payload: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust:
            raise NotFoundException(detail="Customer profile not found", code="CUSTOMER_NOT_FOUND")
        payload.customer_id = cust.id

    sub = create_subscription(payload, current_user.id, db)
    return build_subscription_response(sub, db)


@router.post("/from-template", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED, summary="Create subscription from template")
def create_from_template(
    payload: SubscriptionCreateFromTemplate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust:
            raise NotFoundException(detail="Customer profile not found", code="CUSTOMER_NOT_FOUND")
        payload.customer_id = cust.id

    sub = create_subscription_from_template(payload, current_user.id, db)
    return build_subscription_response(sub, db)


@router.get("/{id}", response_model=SubscriptionResponse, summary="Get subscription details")
def get_subscription(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Subscription)
        .options(
            joinedload(Subscription.customer),
            joinedload(Subscription.plan),
            joinedload(Subscription.lines).joinedload(SubscriptionLine.product),
            joinedload(Subscription.lines).joinedload(SubscriptionLine.variant),
            joinedload(Subscription.events),
        )
        .filter(Subscription.id == id)
        .first()
    )
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        # Strictly return 404 for unowned rows and Draft status
        if not cust or sub.customer_id != cust.id or sub.status == "draft":
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    return build_subscription_response(sub, db)


@router.put("/{id}", response_model=SubscriptionResponse, summary="Update draft or quotation subscription")
def update_subscription(
    id: int,
    payload: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id or sub.status == "draft":
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    # Contract locked check
    if sub.status not in ("draft", "quotation"):
        raise ConflictException(
            detail=f"Subscription is locked in status '{sub.status}'. Header and lines can only be edited in Draft or Quotation status.",
            code="CONTRACT_LOCKED",
        )

    if payload.start_date is not None:
        sub.start_date = payload.start_date
        sub.next_billing_date = payload.start_date
    if payload.expiry_date is not None:
        sub.expiry_date = payload.expiry_date
    if payload.payment_terms is not None:
        sub.payment_terms = payload.payment_terms
    if payload.notes is not None:
        sub.notes = payload.notes

    if payload.lines is not None:
        # Clear existing lines and re-add
        db.query(SubscriptionLine).filter(SubscriptionLine.subscription_id == sub.id).delete()
        for item in payload.lines:
            add_subscription_line(sub, item, sub.plan, db)

    sub.recompute_recurring_subtotal()

    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=sub.status,
        to_status=sub.status,
        action="updated",
        actor_id=current_user.id,
        note="Subscription header and/or lines updated.",
    )
    db.add(event)
    db.commit()

    db.refresh(sub)
    return build_subscription_response(sub, db)


# Add-on lines on Active subscription
@router.post("/{id}/lines/add-on", response_model=SubscriptionResponse, summary="Add new add-on line to active subscription")
def add_addon_line(
    id: int,
    payload: SubscriptionLineCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Staff and Admin only can add new add-on lines
    if current_user.role not in ("admin", "staff"):
        raise ForbiddenException(detail="Only staff and admin can add new add-on lines.", code="FORBIDDEN_ROLE")

    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if sub.status != "active":
        raise ConflictException(detail="Add-on lines can only be added to Active subscriptions.", code="SUBSCRIPTION_NOT_ACTIVE")

    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product or product.type != "add_on":
        raise UnprocessableEntityException(detail="Only products of type 'add_on' can be added.", code="NOT_AN_ADDON")

    add_subscription_line(sub, payload, sub.plan, db)
    sub.recompute_recurring_subtotal()

    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status="active",
        to_status="active",
        action="add_on_added",
        actor_id=current_user.id,
        note=f"Add-on line '{product.name}' added to active subscription.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return build_subscription_response(sub, db)


@router.patch("/{id}/lines/{line_id}/toggle", response_model=SubscriptionResponse, summary="Switch add-on line on or off")
def toggle_addon_line(
    id: int,
    line_id: int,
    payload: ToggleAddOnRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id:
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if sub.status != "active":
        raise ConflictException(detail="Add-ons can only be toggled on an Active subscription.", code="SUBSCRIPTION_NOT_ACTIVE")

    line = (
        db.query(SubscriptionLine)
        .join(SubscriptionLine.product)
        .filter(SubscriptionLine.id == line_id, SubscriptionLine.subscription_id == sub.id)
        .first()
    )
    if not line:
        raise NotFoundException(detail="Subscription line not found", code="LINE_NOT_FOUND")

    if line.product.type != "add_on":
        raise ConflictException(detail="Only add-on lines can be switched on or off on an active contract.", code="NOT_AN_ADDON")

    line.enabled = payload.enabled
    sub.recompute_recurring_subtotal()

    state_str = "enabled" if payload.enabled else "disabled"
    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status="active",
        to_status="active",
        action=f"add_on_{state_str}",
        actor_id=current_user.id,
        note=f"Add-on line '{line.product.name}' was {state_str}.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return build_subscription_response(sub, db)


class StatusTransitionRequest(BaseModel):
    status: str
    note: Optional[str] = None


@router.post("/{id}/status", response_model=SubscriptionResponse, summary="Transition subscription status")
def change_status(
    id: int,
    payload: StatusTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id:
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    updated = transition_subscription_status(
        sub=sub,
        target_status=payload.status,
        actor=current_user,
        db=db,
        note=payload.note,
    )
    return build_subscription_response(updated, db)


@router.post("/{id}/pause", response_model=SubscriptionResponse, summary="Pause an active subscription")
def pause(
    id: int,
    note: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id:
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    updated = pause_subscription(sub=sub, actor=current_user, db=db, note=note)
    return build_subscription_response(updated, db)


@router.post("/{id}/resume", response_model=SubscriptionResponse, summary="Resume a paused subscription")
def resume(
    id: int,
    note: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id:
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    updated = resume_subscription(sub=sub, actor=current_user, db=db, note=note)
    return build_subscription_response(updated, db)


@router.post("/{id}/renew", response_model=SubscriptionResponse, summary="Renew an active subscription")
def renew(
    id: int,
    payload: RenewSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.id == id).first()
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id:
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    updated = renew_subscription(sub=sub, periods=payload.periods, actor=current_user, db=db)
    return build_subscription_response(updated, db)


@router.post("/{id}/invoice-preview", response_model=InvoicePreviewResponse, summary="Preview next invoice without saving")
def preview_next_invoice(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Subscription)
        .options(
            joinedload(Subscription.customer),
            joinedload(Subscription.plan),
            joinedload(Subscription.lines).joinedload(SubscriptionLine.product),
            joinedload(Subscription.lines).joinedload(SubscriptionLine.variant),
        )
        .filter(Subscription.id == id)
        .first()
    )
    if not sub:
        raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or sub.customer_id != cust.id or sub.status == "draft":
            raise NotFoundException(detail="Subscription not found", code="SUBSCRIPTION_NOT_FOUND")

    period_start = sub.next_billing_date
    delta = get_billing_period_relativedelta(sub.plan.billing_period, 1)
    period_end = period_start + delta - timedelta(days=1)
    invoice_date = period_start
    due_date = invoice_date + timedelta(days=get_payment_terms_days(sub.payment_terms))

    pricing = calculate_pricing(sub, today=invoice_date, db=db)

    preview_lines = [
        InvoiceLinePreviewResponse(
            product_id=line.product_id,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            amount=line.amount,
            discount_amount=line.discount_amount,
            tax_name=line.tax_name,
            tax_rate=line.tax_rate,
            tax_amount=line.tax_amount,
            line_total=line.line_total,
        )
        for line in pricing.lines
    ]

    return InvoicePreviewResponse(
        subscription_id=sub.id,
        subscription_number=sub.number,
        period_start=period_start,
        period_end=period_end,
        invoice_date=invoice_date,
        due_date=due_date,
        subtotal=pricing.subtotal,
        discount_total=pricing.discount_total,
        applied_discount_id=pricing.applied_discount.id if pricing.applied_discount else None,
        applied_discount_name=pricing.applied_discount.name if pricing.applied_discount else None,
        tax_total=pricing.tax_total,
        total=pricing.total,
        lines=preview_lines,
    )
