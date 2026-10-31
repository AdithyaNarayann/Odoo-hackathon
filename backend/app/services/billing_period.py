from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


def get_billing_period_relativedelta(period_type: str, n: int = 1) -> relativedelta:
    """Returns relativedelta for n billing periods."""
    period = period_type.lower()
    if period == "daily":
        return relativedelta(days=n)
    elif period == "weekly":
        return relativedelta(weeks=n)
    elif period == "monthly":
        return relativedelta(months=n)
    elif period == "yearly":
        return relativedelta(years=n)
    return relativedelta(months=n)


def compute_period_bounds(original_start_date: date, period_type: str, n: int) -> tuple[date, date]:
    """
    Computes period n start and end date from ORIGINAL start_date with relativedelta.
    Month-end safe, no drift.
    Period n start = original_start_date + n * period.
    Period n end = (original_start_date + (n + 1) * period) - 1 day.
    """
    p_start = original_start_date + get_billing_period_relativedelta(period_type, n)
    p_next_start = original_start_date + get_billing_period_relativedelta(period_type, n + 1)
    p_end = p_next_start - timedelta(days=1)
    return p_start, p_end


def get_payment_terms_days(terms: str) -> int:
    terms_map = {
        "immediate": 0,
        "net_15": 15,
        "net_30": 30,
        "net_45": 45,
    }
    return terms_map.get(terms, 0)
