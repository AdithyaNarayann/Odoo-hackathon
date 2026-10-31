from datetime import date
from typing import Dict, List, Optional
from pydantic import BaseModel


class PreviousPeriodComparison(BaseModel):
    from_date: date
    to_date: date
    revenue_collected: int
    invoiced_total: int


class ReportSummaryResponse(BaseModel):
    from_date: date
    to_date: date
    active_subscriptions: int
    mrr: int
    revenue_collected: int
    invoiced_total: int
    outstanding_amount: int
    outstanding_count: int
    overdue_amount: int
    overdue_count: int
    expiring_within_30_days: int
    subscriptions_by_status: Dict[str, int]
    invoices_by_status: Dict[str, int]
    payments_by_method: Dict[str, int]
    previous_period: PreviousPeriodComparison


class MonthlyRevenueItem(BaseModel):
    month: str  # YYYY-MM
    subscription: int  # paise
    addons: int  # paise
    total: int  # paise


class MonthlyRevenueResponse(BaseModel):
    items: List[MonthlyRevenueItem]
