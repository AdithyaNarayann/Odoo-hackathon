import logging
from datetime import date, datetime
from typing import Any, Dict, Optional
import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.catalog import Plan
from app.models.subscription import Subscription, SubscriptionEvent

logger = logging.getLogger(__name__)

scheduler: Optional[BackgroundScheduler] = None


def get_current_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


def run_daily_maintenance(db: Session, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Daily maintenance task:
    1. Activate Confirmed subscriptions whose start_date is reached.
    2. Auto-close expired Active subscriptions whose plan has auto_close.
    3. Run billing for today.
    Everything is idempotent.
    """
    if as_of_date is None:
        as_of_date = get_current_today()

    logger.info("Starting daily maintenance as of date %s", as_of_date)

    # 1. Activate Confirmed subscriptions where start_date <= as_of_date
    to_activate = (
        db.query(Subscription)
        .filter(
            Subscription.status == "confirmed",
            Subscription.start_date <= as_of_date,
        )
        .all()
    )
    activated_count = 0
    for sub in to_activate:
        sub.status = "active"
        event = SubscriptionEvent(
            subscription_id=sub.id,
            from_status="confirmed",
            to_status="active",
            action="auto_activated",
            note=f"Automatically activated on reached start date ({as_of_date}).",
        )
        db.add(event)
        activated_count += 1
    db.commit()

    # 2. Auto-close expired Active subscriptions where expiry_date < as_of_date and plan.auto_close is True
    to_close = (
        db.query(Subscription)
        .join(Subscription.plan)
        .filter(
            Subscription.status == "active",
            Subscription.expiry_date < as_of_date,
            Plan.auto_close == True,
        )
        .all()
    )
    auto_closed_count = 0
    for sub in to_close:
        sub.status = "closed"
        event = SubscriptionEvent(
            subscription_id=sub.id,
            from_status="active",
            to_status="closed",
            action="auto_closed",
            note=f"Automatically closed on expiry date ({sub.expiry_date}) as per plan auto_close flag.",
        )
        db.add(event)
        auto_closed_count += 1
    db.commit()

    # 3. Run billing for today
    billing_result: Dict[str, Any] = {"due": 0, "created": 0, "already_billed": 0, "failed": [], "total_amount": 0}
    try:
        from app.services.billing import run_billing_engine
        billing_result = run_billing_engine(db, as_of_date=as_of_date)
    except ImportError:
        logger.debug("Billing engine not yet wired into daily maintenance")
    except Exception as exc:
        logger.error("Error running daily billing engine: %s", exc, exc_info=True)

    logger.info(
        "Daily maintenance finished. Activated: %d, Auto-closed: %d, Billing created: %d",
        activated_count,
        auto_closed_count,
        billing_result.get("created", 0),
    )

    return {
        "as_of_date": as_of_date,
        "activated_count": activated_count,
        "auto_closed_count": auto_closed_count,
        "billing": billing_result,
    }


def _daily_job_wrapper():
    """Wrapper invoked by APScheduler to handle session management."""
    db = SessionLocal()
    try:
        run_daily_maintenance(db)
    except Exception as exc:
        logger.error("Failed executing scheduled daily maintenance: %s", exc, exc_info=True)
    finally:
        db.close()


def start_scheduler():
    global scheduler
    if not settings.SCHEDULER_ENABLED:
        logger.info("In-process scheduler is disabled by configuration (SCHEDULER_ENABLED=False).")
        return

    tz = pytz.timezone(settings.APP_TIMEZONE)
    scheduler = BackgroundScheduler(timezone=tz)

    # Daily trigger at configured hour and minute
    trigger = CronTrigger(
        hour=settings.SCHEDULER_HOUR,
        minute=settings.SCHEDULER_MINUTE,
        timezone=tz,
    )
    scheduler.add_job(
        _daily_job_wrapper,
        trigger=trigger,
        id="daily_maintenance",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        "Scheduler started. Daily maintenance scheduled at %02d:%02d (%s).",
        settings.SCHEDULER_HOUR,
        settings.SCHEDULER_MINUTE,
        settings.APP_TIMEZONE,
    )

    # Run once at startup
    logger.info("Executing startup maintenance pass...")
    _daily_job_wrapper()


def stop_scheduler():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down successfully.")
