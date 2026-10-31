from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import time
from typing import Dict, List, Optional, Tuple
import pytz
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.catalog import Plan, Product
from app.models.invoice import Invoice, InvoiceLine
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.schemas.report import (
    MonthlyRevenueItem,
    MonthlyRevenueResponse,
    PreviousPeriodComparison,
    ReportSummaryResponse,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])

# In-process cache for summary report
_SUMMARY_CACHE: Dict[Tuple, Tuple[float, ReportSummaryResponse]] = {}
_CACHE_TTL_SECONDS = 30.0


def clear_reports_cache():
    global _SUMMARY_CACHE
    _SUMMARY_CACHE.clear()


def get_current_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


@router.get("/summary", response_model=ReportSummaryResponse, summary="Get summary business report")
def get_reports_summary(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    plan_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "staff")),
):
    today = get_current_today()
    if to_date is None:
        to_date = today
    if from_date is None:
        # Default from_date to start of current month
        from_date = today.replace(day=1)

    cache_key = (from_date, to_date, plan_id, customer_id)
    now_ts = time.time()
    if cache_key in _SUMMARY_CACHE:
        cached_ts, cached_val = _SUMMARY_CACHE[cache_key]
        if now_ts - cached_ts < _CACHE_TTL_SECONDS:
            return cached_val

    # 1. active_subscriptions
    active_q = db.query(func.count(Subscription.id)).filter(Subscription.status == "active")
    if plan_id:
        active_q = active_q.filter(Subscription.plan_id == plan_id)
    if customer_id:
        active_q = active_q.filter(Subscription.customer_id == customer_id)
    active_subs_count = active_q.scalar() or 0

    # 2. mrr (Active, not paused, recurring_subtotal normalised to month)
    mrr_q = (
        db.query(Plan.billing_period, func.sum(Subscription.recurring_subtotal))
        .join(Plan, Subscription.plan_id == Plan.id)
        .filter(Subscription.status == "active", Subscription.is_paused == False)
    )
    if plan_id:
        mrr_q = mrr_q.filter(Subscription.plan_id == plan_id)
    if customer_id:
        mrr_q = mrr_q.filter(Subscription.customer_id == customer_id)
    mrr_groups = mrr_q.group_by(Plan.billing_period).all()

    total_mrr = 0
    for period, subtotal_sum in mrr_groups:
        if not subtotal_sum:
            continue
        val = Decimal(subtotal_sum)
        if period == "monthly":
            total_mrr += int(val)
        elif period == "yearly":
            total_mrr += int((val / Decimal(12)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        elif period == "weekly":
            total_mrr += int(((val * Decimal(52)) / Decimal(12)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        elif period == "daily":
            total_mrr += int(((val * Decimal(365)) / Decimal(12)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    # 3. revenue_collected in range [from_date, to_date]
    rev_q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= from_date,
        Payment.payment_date <= to_date,
    )
    if customer_id or plan_id:
        rev_q = rev_q.join(Invoice, Payment.invoice_id == Invoice.id)
        if customer_id:
            rev_q = rev_q.filter(Invoice.customer_id == customer_id)
        if plan_id:
            rev_q = rev_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
                Subscription.plan_id == plan_id
            )
    revenue_collected = rev_q.scalar() or 0

    # 4. invoiced_total (non-cancelled invoices in range [from_date, to_date])
    inv_tot_q = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(
        Invoice.status != "cancelled",
        Invoice.invoice_date >= from_date,
        Invoice.invoice_date <= to_date,
    )
    if customer_id:
        inv_tot_q = inv_tot_q.filter(Invoice.customer_id == customer_id)
    if plan_id:
        inv_tot_q = inv_tot_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
            Subscription.plan_id == plan_id
        )
    invoiced_total = inv_tot_q.scalar() or 0

    # 5. outstanding_amount & outstanding_count (confirmed, balance > 0)
    out_q = db.query(
        func.coalesce(func.sum(Invoice.balance), 0),
        func.count(Invoice.id),
    ).filter(
        Invoice.status == "confirmed",
        Invoice.balance > 0,
    )
    if customer_id:
        out_q = out_q.filter(Invoice.customer_id == customer_id)
    if plan_id:
        out_q = out_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
            Subscription.plan_id == plan_id
        )
    outstanding_amount, outstanding_count = out_q.one()

    # 6. overdue_amount & overdue_count (confirmed, due_date < today, balance > 0)
    ovd_q = db.query(
        func.coalesce(func.sum(Invoice.balance), 0),
        func.count(Invoice.id),
    ).filter(
        Invoice.status == "confirmed",
        Invoice.due_date < today,
        Invoice.balance > 0,
    )
    if customer_id:
        ovd_q = ovd_q.filter(Invoice.customer_id == customer_id)
    if plan_id:
        ovd_q = ovd_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
            Subscription.plan_id == plan_id
        )
    overdue_amount, overdue_count = ovd_q.one()

    # 7. expiring_within_30_days (active, expiry_date between today and today + 30)
    exp_q = db.query(func.count(Subscription.id)).filter(
        Subscription.status == "active",
        Subscription.expiry_date >= today,
        Subscription.expiry_date <= today + timedelta(days=30),
    )
    if plan_id:
        exp_q = exp_q.filter(Subscription.plan_id == plan_id)
    if customer_id:
        exp_q = exp_q.filter(Subscription.customer_id == customer_id)
    expiring_within_30_days = exp_q.scalar() or 0

    # 8. subscriptions_by_status
    subs_stat_q = db.query(Subscription.status, Subscription.is_paused, func.count(Subscription.id))
    if plan_id:
        subs_stat_q = subs_stat_q.filter(Subscription.plan_id == plan_id)
    if customer_id:
        subs_stat_q = subs_stat_q.filter(Subscription.customer_id == customer_id)
    subs_stat_rows = subs_stat_q.group_by(Subscription.status, Subscription.is_paused).all()

    subs_by_status = {
        "draft": 0,
        "quotation": 0,
        "confirmed": 0,
        "active": 0,
        "paused": 0,
        "closed": 0,
    }
    for stat, is_paused, count in subs_stat_rows:
        if stat == "active" and is_paused:
            subs_by_status["paused"] += count
        elif stat in subs_by_status:
            subs_by_status[stat] += count

    # 9. invoices_by_status
    inv_stat_q = db.query(Invoice.status, func.count(Invoice.id))
    if customer_id:
        inv_stat_q = inv_stat_q.filter(Invoice.customer_id == customer_id)
    if plan_id:
        inv_stat_q = inv_stat_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
            Subscription.plan_id == plan_id
        )
    inv_stat_rows = inv_stat_q.group_by(Invoice.status).all()

    invs_by_status = {
        "draft": 0,
        "confirmed": 0,
        "paid": 0,
        "cancelled": 0,
    }
    for stat, count in inv_stat_rows:
        if stat in invs_by_status:
            invs_by_status[stat] = count

    # 10. payments_by_method (in range [from_date, to_date])
    pay_m_q = db.query(Payment.method, func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= from_date,
        Payment.payment_date <= to_date,
    )
    if customer_id or plan_id:
        pay_m_q = pay_m_q.join(Invoice, Payment.invoice_id == Invoice.id)
        if customer_id:
            pay_m_q = pay_m_q.filter(Invoice.customer_id == customer_id)
        if plan_id:
            pay_m_q = pay_m_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
                Subscription.plan_id == plan_id
            )
    pay_m_rows = pay_m_q.group_by(Payment.method).all()

    payments_by_method = {
        "cash": 0,
        "card": 0,
        "upi": 0,
        "bank_transfer": 0,
        "cheque": 0,
    }
    for method, amt in pay_m_rows:
        if method in payments_by_method:
            payments_by_method[method] = amt

    # 11. previous_period (comparison for revenue_collected and invoiced_total)
    days = (to_date - from_date).days + 1
    prev_to = from_date - timedelta(days=1)
    prev_from = prev_to - timedelta(days=days - 1)

    prev_rev_q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= prev_from,
        Payment.payment_date <= prev_to,
    )
    if customer_id or plan_id:
        prev_rev_q = prev_rev_q.join(Invoice, Payment.invoice_id == Invoice.id)
        if customer_id:
            prev_rev_q = prev_rev_q.filter(Invoice.customer_id == customer_id)
        if plan_id:
            prev_rev_q = prev_rev_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
                Subscription.plan_id == plan_id
            )
    prev_revenue_collected = prev_rev_q.scalar() or 0

    prev_inv_q = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(
        Invoice.status != "cancelled",
        Invoice.invoice_date >= prev_from,
        Invoice.invoice_date <= prev_to,
    )
    if customer_id:
        prev_inv_q = prev_inv_q.filter(Invoice.customer_id == customer_id)
    if plan_id:
        prev_inv_q = prev_inv_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
            Subscription.plan_id == plan_id
        )
    prev_invoiced_total = prev_inv_q.scalar() or 0

    response = ReportSummaryResponse(
        from_date=from_date,
        to_date=to_date,
        active_subscriptions=active_subs_count,
        mrr=total_mrr,
        revenue_collected=revenue_collected,
        invoiced_total=invoiced_total,
        outstanding_amount=outstanding_amount,
        outstanding_count=outstanding_count,
        overdue_amount=overdue_amount,
        overdue_count=overdue_count,
        expiring_within_30_days=expiring_within_30_days,
        subscriptions_by_status=subs_by_status,
        invoices_by_status=invs_by_status,
        payments_by_method=payments_by_method,
        previous_period=PreviousPeriodComparison(
            from_date=prev_from,
            to_date=prev_to,
            revenue_collected=prev_revenue_collected,
            invoiced_total=prev_invoiced_total,
        ),
    )

    _SUMMARY_CACHE[cache_key] = (now_ts, response)
    return response


@router.get("/revenue-by-month", response_model=MonthlyRevenueResponse, summary="Invoiced revenue per month")
def get_revenue_by_month(
    months: int = Query(8, ge=1, le=36),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "staff")),
):
    today = get_current_today()
    # Compute earliest month start date
    # Example: if months=8, and today is 2026-10-31, we want 8 months: 2026-03 through 2026-10
    start_of_current_month = today.replace(day=1)
    earliest_month_start = start_of_current_month - relativedelta(months=months - 1)

    # Pre-populate all months in list
    months_list: List[str] = []
    temp_date = earliest_month_start
    for _ in range(months):
        months_list.append(temp_date.strftime("%Y-%m"))
        temp_date = temp_date + relativedelta(months=1)

    month_data: Dict[str, Dict[str, int]] = {
        m: {"subscription": 0, "addons": 0, "total": 0} for m in months_list
    }

    year_col = func.extract("year", Invoice.invoice_date)
    month_col = func.extract("month", Invoice.invoice_date)
    is_addon_col = case((Product.type == "add_on", "addon"), else_="subscription")

    results = (
        db.query(
            year_col,
            month_col,
            is_addon_col,
            func.sum(InvoiceLine.line_total),
        )
        .join(Invoice, InvoiceLine.invoice_id == Invoice.id)
        .outerjoin(Product, InvoiceLine.product_id == Product.id)
        .filter(
            Invoice.status.in_(["confirmed", "paid"]),
            Invoice.invoice_date >= earliest_month_start,
            Invoice.invoice_date <= today,
        )
        .group_by(year_col, month_col, is_addon_col)
        .all()
    )

    for y, m, line_type, line_total_sum in results:
        if not y or not m or not line_total_sum:
            continue
        month_str = f"{int(y):04d}-{int(m):02d}"
        if month_str in month_data:
            if line_type == "addon":
                month_data[month_str]["addons"] += int(line_total_sum)
            else:
                month_data[month_str]["subscription"] += int(line_total_sum)
            month_data[month_str]["total"] += int(line_total_sum)

    items = [
        MonthlyRevenueItem(
            month=m,
            subscription=month_data[m]["subscription"],
            addons=month_data[m]["addons"],
            total=month_data[m]["total"],
        )
        for m in months_list
    ]

    return MonthlyRevenueResponse(items=items)
