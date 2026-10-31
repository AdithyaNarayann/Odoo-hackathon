from datetime import date, datetime, timedelta
from typing import Optional
from dateutil.relativedelta import relativedelta
import pytz
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ConflictException, ForbiddenException, NotFoundException
from app.models.subscription import Subscription, SubscriptionEvent
from app.models.user import User


def get_business_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


def is_owning_customer(sub: Subscription, actor: User) -> bool:
    if actor.role != "customer":
        return False
    return sub.customer.user_id == actor.id


def transition_subscription_status(
    sub: Subscription,
    target_status: str,
    actor: User,
    db: Session,
    today: Optional[date] = None,
    note: Optional[str] = None,
) -> Subscription:
    """
    State machine for subscription transitions.
    Illegal moves return 409 ConflictException with clear messages.
    """
    if today is None:
        today = get_business_today()

    current_status = sub.status
    target = target_status.lower()

    if current_status == target:
        return sub

    # 1. Draft to Quotation
    if current_status == "draft" and target == "quotation":
        validity = sub.template.validity_days if sub.template else 30
        sub.quotation_valid_until = today + timedelta(days=validity)
        sub.status = "quotation"

    # 2. Quotation to Draft (Revise)
    elif current_status == "quotation" and target == "draft":
        sub.status = "draft"

    # 3. Quotation to Confirmed
    elif current_status == "quotation" and target == "confirmed":
        # Check permissions: staff, admin, or owning customer
        if actor.role == "customer" and not is_owning_customer(sub, actor):
            raise ForbiddenException(detail="Customer can only confirm their own quotation.", code="FORBIDDEN_ROLE")

        # Must have at least one enabled line
        if not any(line.enabled for line in sub.lines):
            raise ConflictException(
                detail="Quotation cannot be confirmed without at least one enabled line.",
                code="NO_ENABLED_LINES",
            )

        # Must not be expired
        if sub.quotation_valid_until is not None and sub.quotation_valid_until < today:
            raise ConflictException(
                detail=f"Quotation expired on {sub.quotation_valid_until}. Please revise the quotation before confirming.",
                code="QUOTATION_EXPIRED",
            )

        sub.status = "confirmed"

    # 4. Confirmed to Active
    elif current_status == "confirmed" and target == "active":
        if actor.role == "customer":
            raise ForbiddenException(detail="Only staff and admin can activate subscriptions.", code="FORBIDDEN_ROLE")
        sub.status = "active"

    # 5. Draft, Quotation, or Confirmed to Closed (deal lost)
    elif current_status in ("draft", "quotation", "confirmed") and target == "closed":
        if actor.role == "customer":
            raise ForbiddenException(detail="Only staff and admin can close deals.", code="FORBIDDEN_ROLE")
        sub.status = "closed"

    # 6. Active to Closed
    elif current_status == "active" and target == "closed":
        expired = today > sub.expiry_date
        closable = sub.plan.closable

        if not expired and not closable:
            raise ConflictException(
                detail="Subscription cannot be closed before expiry date because the plan's 'closable' flag is False.",
                code="PLAN_NOT_CLOSABLE",
            )

        if actor.role == "customer":
            if not is_owning_customer(sub, actor):
                raise ForbiddenException(detail="Unauthorized", code="FORBIDDEN_ROLE")
            if expired:
                raise ForbiddenException(detail="Customer cannot manually close an already expired subscription; closing is automatic/staff.", code="FORBIDDEN_ROLE")
            # Customer can close before expiry only if plan.closable
            if not closable:
                raise ConflictException(detail="Plan cannot be closed before expiry.", code="PLAN_NOT_CLOSABLE")

        sub.status = "closed"

    else:
        raise ConflictException(
            detail=f"Illegal state transition from '{current_status}' to '{target}'.",
            code="ILLEGAL_STATUS_TRANSITION",
        )

    # Record event
    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=current_status,
        to_status=sub.status,
        action=f"transition_{sub.status}",
        actor_id=actor.id if actor else None,
        note=note or f"Status changed from {current_status} to {sub.status}.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return sub


def pause_subscription(
    sub: Subscription,
    actor: User,
    db: Session,
    note: Optional[str] = None,
) -> Subscription:
    if sub.status != "active":
        raise ConflictException(detail="Only Active subscriptions can be paused.", code="SUBSCRIPTION_NOT_ACTIVE")
    if sub.is_paused:
        raise ConflictException(detail="Subscription is already paused.", code="ALREADY_PAUSED")

    # Plan flags apply to everyone including admin
    if not sub.plan.pausable:
        raise ConflictException(detail="This plan does not permit pausing (pausable flag is False).", code="PLAN_NOT_PAUSABLE")

    if actor.role == "customer" and not is_owning_customer(sub, actor):
        raise ForbiddenException(detail="Unauthorized", code="FORBIDDEN_ROLE")

    sub.is_paused = True
    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=sub.status,
        to_status=sub.status,
        action="pause",
        actor_id=actor.id,
        note=note or "Subscription paused.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return sub


def resume_subscription(
    sub: Subscription,
    actor: User,
    db: Session,
    today: Optional[date] = None,
    note: Optional[str] = None,
) -> Subscription:
    if sub.status != "active":
        raise ConflictException(detail="Only Active subscriptions can be resumed.", code="SUBSCRIPTION_NOT_ACTIVE")
    if not sub.is_paused:
        raise ConflictException(detail="Subscription is not currently paused.", code="NOT_PAUSED")

    if actor.role == "customer" and not is_owning_customer(sub, actor):
        raise ForbiddenException(detail="Unauthorized", code="FORBIDDEN_ROLE")

    if today is None:
        today = get_business_today()

    # On resume, if next_billing_date is in the past, set it to today (paused time is not billed)
    if sub.next_billing_date < today:
        sub.next_billing_date = today

    sub.is_paused = False
    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=sub.status,
        to_status=sub.status,
        action="resume",
        actor_id=actor.id,
        note=note or "Subscription resumed.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return sub


def renew_subscription(
    sub: Subscription,
    periods: int,
    actor: User,
    db: Session,
    note: Optional[str] = None,
) -> Subscription:
    if sub.status != "active":
        raise ConflictException(detail="Only Active subscriptions can be renewed.", code="SUBSCRIPTION_NOT_ACTIVE")

    # Plan flags apply to everyone including admin
    if not sub.plan.renewable:
        raise ConflictException(detail="This plan does not permit renewals (renewable flag is False).", code="PLAN_NOT_RENEWABLE")

    if actor.role == "customer" and not is_owning_customer(sub, actor):
        raise ForbiddenException(detail="Unauthorized", code="FORBIDDEN_ROLE")

    if periods < 1 or periods > 36:
        raise ConflictException(detail="Renew periods must be between 1 and 36.", code="INVALID_PERIODS")

    period_map = {
        "daily": relativedelta(days=periods),
        "weekly": relativedelta(weeks=periods),
        "monthly": relativedelta(months=periods),
        "yearly": relativedelta(years=periods),
    }
    delta = period_map.get(sub.plan.billing_period, relativedelta(months=periods))
    old_expiry = sub.expiry_date
    sub.expiry_date = sub.expiry_date + delta

    event = SubscriptionEvent(
        subscription_id=sub.id,
        from_status=sub.status,
        to_status=sub.status,
        action="renew",
        actor_id=actor.id,
        note=note or f"Subscription renewed for {periods} period(s). Expiry extended from {old_expiry} to {sub.expiry_date}.",
    )
    db.add(event)
    db.commit()
    db.refresh(sub)
    return sub
