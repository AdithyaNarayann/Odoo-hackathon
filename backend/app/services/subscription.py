from datetime import date, datetime
from typing import List, Optional
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session, joinedload

from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException
from app.models.catalog import Plan, Product, ProductVariant, QuotationTemplate, TaxRule
from app.models.customer import Customer
from app.models.sequence import get_next_subscription_number
from app.models.subscription import Subscription, SubscriptionEvent, SubscriptionLine
from app.models.user import User
from app.routers.taxes import resolve_product_tax
from app.schemas.subscription import (
    SubscriptionCardResponse,
    SubscriptionCreate,
    SubscriptionCreateFromTemplate,
    SubscriptionEventResponse,
    SubscriptionLineCreate,
    SubscriptionLineResponse,
    SubscriptionResponse,
)


def validate_plan_availability(plan: Plan, start_date: date) -> None:
    if not plan.is_active:
        raise UnprocessableEntityException(
            detail=f"Plan '{plan.name}' is inactive.",
            code="PLAN_INACTIVE",
        )
    if plan.available_from and start_date < plan.available_from:
        raise UnprocessableEntityException(
            detail=f"Subscription start date {start_date} is before plan availability starts ({plan.available_from}).",
            code="START_DATE_BEFORE_PLAN_AVAILABILITY",
        )
    if plan.available_to and start_date > plan.available_to:
        raise UnprocessableEntityException(
            detail=f"Subscription start date {start_date} is after plan availability ends ({plan.available_to}).",
            code="START_DATE_AFTER_PLAN_AVAILABILITY",
        )


def build_subscription_response(sub: Subscription, db: Session) -> SubscriptionResponse:
    lines_resp: List[SubscriptionLineResponse] = []
    for line in sub.lines:
        variant_label = f"{line.variant.attribute}: {line.variant.value}" if line.variant else None
        tax_res = resolve_product_tax(line.product, db)
        lines_resp.append(
            SubscriptionLineResponse(
                id=line.id,
                product_id=line.product_id,
                product_name=line.product.name,
                product_type=line.product.type,
                variant_id=line.variant_id,
                variant_label=variant_label,
                quantity=line.quantity,
                unit_price=line.unit_price,
                amount=line.amount,
                enabled=line.enabled,
                current_tax_rate=tax_res.rate,
            )
        )

    events_resp = [
        SubscriptionEventResponse(
            id=ev.id,
            from_status=ev.from_status,
            to_status=ev.to_status,
            action=ev.action,
            actor_id=ev.actor_id,
            actor_name=ev.actor.full_name if ev.actor else None,
            timestamp=ev.timestamp,
            note=ev.note,
        )
        for ev in sub.events
    ]

    return SubscriptionResponse(
        id=sub.id,
        number=sub.number,
        customer_id=sub.customer_id,
        customer_name=sub.customer.name,
        customer_company=sub.customer.company_name,
        plan_id=sub.plan_id,
        plan_name=sub.plan.name,
        plan_price=sub.plan.price,
        plan_billing_period=sub.plan.billing_period,
        start_date=sub.start_date,
        expiry_date=sub.expiry_date,
        payment_terms=sub.payment_terms,
        status=sub.status,
        next_billing_date=sub.next_billing_date,
        is_paused=sub.is_paused,
        quotation_valid_until=sub.quotation_valid_until,
        template_id=sub.template_id,
        notes=sub.notes,
        recurring_subtotal=sub.recurring_subtotal,
        lines=lines_resp,
        events=events_resp,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
    )


def create_subscription(
    payload: SubscriptionCreate,
    creator_id: int,
    db: Session,
) -> Subscription:
    # 1. Validate Customer
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer or not customer.is_active:
        raise UnprocessableEntityException(detail="Customer not found or inactive", code="INVALID_CUSTOMER")

    # 2. Validate Plan
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise UnprocessableEntityException(detail="Plan not found", code="INVALID_PLAN")
    validate_plan_availability(plan, payload.start_date)

    # 3. Create Subscription
    sub_number = get_next_subscription_number(db)
    sub = Subscription(
        number=sub_number,
        customer_id=payload.customer_id,
        plan_id=payload.plan_id,
        start_date=payload.start_date,
        expiry_date=payload.expiry_date,
        payment_terms=payload.payment_terms,
        status="draft",
        next_billing_date=payload.start_date,
        is_paused=False,
        template_id=payload.template_id,
        notes=payload.notes,
        created_by=creator_id,
        recurring_subtotal=plan.price,
    )
    db.add(sub)
    db.flush()

    # 4. Create Lines
    if payload.lines:
        for item in payload.lines:
            add_subscription_line(sub, item, plan, db)

    sub.recompute_recurring_subtotal()

    # Record event
    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=None,
        to_status="draft",
        action="created",
        actor_id=creator_id,
        note="Subscription created in Draft status.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return sub


def add_subscription_line(
    sub: Subscription,
    item: SubscriptionLineCreate,
    plan: Plan,
    db: Session,
) -> SubscriptionLine:
    if item.quantity < plan.min_quantity:
        raise UnprocessableEntityException(
            detail=f"Line quantity ({item.quantity}) must be at least plan minimum quantity ({plan.min_quantity}).",
            code="QUANTITY_BELOW_MINIMUM",
        )

    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product or not product.is_active:
        raise UnprocessableEntityException(
            detail=f"Product with id {item.product_id} is invalid or inactive.",
            code="PRODUCT_INACTIVE",
        )

    extra_price = 0
    if item.variant_id is not None:
        variant = db.query(ProductVariant).filter(
            ProductVariant.id == item.variant_id,
            ProductVariant.product_id == item.product_id,
        ).first()
        if not variant:
            raise UnprocessableEntityException(
                detail=f"Variant {item.variant_id} does not belong to product {item.product_id}.",
                code="INVALID_VARIANT",
            )
        extra_price = variant.extra_price

    unit_price = product.sales_price + extra_price
    amount = item.quantity * unit_price

    line = SubscriptionLine(
        subscription_id=sub.id,
        product_id=item.product_id,
        variant_id=item.variant_id,
        quantity=item.quantity,
        unit_price=unit_price,
        amount=amount,
        enabled=True,
    )
    db.add(line)
    if line not in sub.lines:
        sub.lines.append(line)
    return line


def create_subscription_from_template(
    payload: SubscriptionCreateFromTemplate,
    creator_id: int,
    db: Session,
) -> Subscription:
    template = (
        db.query(QuotationTemplate)
        .options(joinedload(QuotationTemplate.lines))
        .filter(QuotationTemplate.id == payload.template_id)
        .first()
    )
    if not template or not template.is_active:
        raise NotFoundException(detail="Quotation template not found or inactive", code="TEMPLATE_NOT_FOUND")

    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer or not customer.is_active:
        raise UnprocessableEntityException(detail="Customer not found or inactive", code="INVALID_CUSTOMER")

    plan = template.plan
    validate_plan_availability(plan, payload.start_date)

    # Compute default expiry_date if not passed (e.g. 1 year or 1 billing period)
    if payload.expiry_date:
        expiry_date = payload.expiry_date
    else:
        period_map = {
            "daily": relativedelta(days=30),
            "weekly": relativedelta(weeks=12),
            "monthly": relativedelta(years=1),
            "yearly": relativedelta(years=1),
        }
        expiry_date = payload.start_date + period_map.get(plan.billing_period, relativedelta(years=1))

    sub_number = get_next_subscription_number(db)
    sub = Subscription(
        number=sub_number,
        customer_id=payload.customer_id,
        plan_id=plan.id,
        start_date=payload.start_date,
        expiry_date=expiry_date,
        payment_terms=payload.payment_terms,
        status="draft",
        next_billing_date=payload.start_date,
        is_paused=False,
        template_id=template.id,
        notes=payload.notes,
        created_by=creator_id,
        recurring_subtotal=plan.price,
    )
    db.add(sub)
    db.flush()

    for t_line in template.lines:
        line_item = SubscriptionLineCreate(
            product_id=t_line.product_id,
            variant_id=t_line.variant_id,
            quantity=t_line.quantity,
        )
        add_subscription_line(sub, line_item, plan, db)

    sub.recompute_recurring_subtotal()

    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=None,
        to_status="draft",
        action="created_from_template",
        actor_id=creator_id,
        note=f"Subscription created from template '{template.name}'.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return sub
