import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set
import pytz
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.sequence import get_next_invoice_number
from app.models.subscription import Subscription
from app.services.billing_period import (
    compute_period_bounds,
    get_payment_terms_days,
)
from app.services.pricing import (
    calculate_pricing,
    release_discount_usage,
    try_claim_discount_usage,
)

logger = logging.getLogger(__name__)


def get_current_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


def run_billing_engine(
    db: Session,
    as_of_date: Optional[date] = None,
    subscription_ids: Optional[List[int]] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Selects Active, not paused subscriptions with next_billing_date <= as_of_date
    and next_billing_date <= expiry_date.
    Processes in chunks of 200, each subscription in its own transaction.
    Bills every missed period in order, up to 60 periods per subscription per run.
    Creates Draft invoices.
    Returns {due, created, already_billed, failed:[{subscription, reason}], total_amount}.
    dry_run writes nothing. A second run creates nothing.
    """
    if as_of_date is None:
        as_of_date = get_current_today()

    if subscription_ids:
        query = (
            db.query(Subscription)
            .filter(
                Subscription.id.in_(subscription_ids),
                Subscription.status == "active",
                Subscription.is_paused == False,
            )
        )
    else:
        query = (
            db.query(Subscription)
            .filter(
                Subscription.status == "active",
                Subscription.is_paused == False,
                Subscription.next_billing_date <= as_of_date,
                Subscription.next_billing_date <= Subscription.expiry_date,
            )
        )

    candidate_ids = [s.id for s in query.order_by(Subscription.id.asc()).all()]

    due_count = 0
    created_count = 0
    already_billed_count = 0
    total_amount = 0
    failed: List[Dict[str, str]] = []

    # Process in chunks of 200
    chunk_size = 200
    for i in range(0, len(candidate_ids), chunk_size):
        chunk_ids = candidate_ids[i : i + chunk_size]

        for sub_id in chunk_ids:
            try:
                # Each subscription in its own savepoint/transaction
                with db.begin_nested():
                    sub = db.query(Subscription).filter(Subscription.id == sub_id).with_for_update().first()
                    if not sub or sub.status != "active" or sub.is_paused:
                        continue

                    # Query all existing period_starts for this subscription
                    existing_starts: Set[date] = {
                        row[0]
                        for row in db.query(Invoice.period_start)
                        .filter(Invoice.subscription_id == sub.id)
                        .all()
                    }

                    periods_billed_this_sub = 0
                    max_periods = 60
                    n = 0

                    # Find and bill periods in order
                    while periods_billed_this_sub < max_periods:
                        p_start, p_end = compute_period_bounds(sub.start_date, sub.plan.billing_period, n)

                        if p_start > as_of_date or p_start > sub.expiry_date:
                            # Reached beyond as_of_date or expiry_date
                            break

                        if p_start in existing_starts:
                            already_billed_count += 1
                            n += 1
                            continue

                        # Period is due
                        due_count += 1

                        if dry_run:
                            # In dry-run, we estimate without persisting
                            pricing = calculate_pricing(sub, today=p_start, db=db)
                            created_count += 1
                            total_amount += pricing.total
                            existing_starts.add(p_start)
                            periods_billed_this_sub += 1
                            n += 1
                            continue

                        # Real run: pricing calculation with atomic discount claim and fallback
                        excluded_discount_ids: Set[int] = set()
                        claimed_discount_id: Optional[int] = None
                        pricing = None

                        while True:
                            pricing = calculate_pricing(
                                sub,
                                today=p_start,
                                db=db,
                                excluded_discount_ids=excluded_discount_ids,
                            )
                            if pricing.applied_discount:
                                success = try_claim_discount_usage(db, pricing.applied_discount.id)
                                if success:
                                    claimed_discount_id = pricing.applied_discount.id
                                    break
                                else:
                                    # Usage exhausted; retry without this discount
                                    excluded_discount_ids.add(pricing.applied_discount.id)
                            else:
                                break

                        # Generate invoice number
                        inv_number = get_next_invoice_number(db, p_start.year)
                        cust = sub.customer
                        due_date = p_start + timedelta(days=get_payment_terms_days(sub.payment_terms))

                        invoice = Invoice(
                            number=inv_number,
                            subscription_id=sub.id,
                            customer_id=cust.id,
                            customer_name=cust.name,
                            company_name=cust.company_name,
                            customer_email=cust.email,
                            billing_address_line1=cust.address_line1,
                            billing_address_line2=cust.address_line2,
                            city=cust.city,
                            state=cust.state,
                            postal_code=cust.postal_code,
                            country=cust.country,
                            tax_id=cust.tax_id,
                            period_start=p_start,
                            period_end=p_end,
                            invoice_date=p_start,
                            due_date=due_date,
                            status="draft",
                            subtotal=pricing.subtotal,
                            discount_total=pricing.discount_total,
                            tax_total=pricing.tax_total,
                            total=pricing.total,
                            amount_paid=0,
                            balance=pricing.total,
                            applied_discount_id=claimed_discount_id,
                            discount_name=pricing.applied_discount.name if pricing.applied_discount else None,
                        )
                        db.add(invoice)
                        db.flush()

                        for line in pricing.lines:
                            inv_line = InvoiceLine(
                                invoice_id=invoice.id,
                                product_id=line.product_id,
                                description=line.description,
                                quantity=line.quantity,
                                unit_price=line.unit_price,
                                discount_amount=line.discount_amount,
                                tax_name=line.tax_name,
                                tax_rate=line.tax_rate,
                                tax_amount=line.tax_amount,
                                line_total=line.line_total,
                            )
                            db.add(inv_line)

                        existing_starts.add(p_start)
                        created_count += 1
                        total_amount += pricing.total
                        periods_billed_this_sub += 1
                        n += 1

                    # Update next_billing_date to start of next unbilled period
                    next_p_start, _ = compute_period_bounds(sub.start_date, sub.plan.billing_period, n)
                    sub.next_billing_date = next_p_start

                    if dry_run:
                        # Rollback nested transaction in dry-run
                        raise _DryRunRollbackException()

                # Commit subscription transaction
                if not dry_run:
                    db.commit()

            except _DryRunRollbackException:
                pass
            except Exception as exc:
                db.rollback()
                logger.error("Failed billing subscription %s: %s", sub_id, exc, exc_info=True)
                failed.append({"subscription": f"Sub-{sub_id}", "reason": str(exc)})

    return {
        "due": due_count,
        "created": created_count,
        "already_billed": already_billed_count,
        "failed": failed,
        "total_amount": total_amount,
    }


class _DryRunRollbackException(Exception):
    pass
