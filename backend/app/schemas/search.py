from datetime import date
from typing import List, Optional
from pydantic import BaseModel


class SearchCustomerItem(BaseModel):
    id: int
    name: str
    company_name: str
    email: str
    phone: Optional[str] = None


class SearchSubscriptionItem(BaseModel):
    id: int
    number: str
    status: str
    customer_id: int
    customer_name: str
    plan_name: str
    recurring_subtotal: int


class SearchInvoiceItem(BaseModel):
    id: int
    number: str
    status: str
    customer_id: int
    customer_name: str
    total: int
    balance: int
    due_date: date


class SearchResponse(BaseModel):
    customers: List[SearchCustomerItem]
    subscriptions: List[SearchSubscriptionItem]
    invoices: List[SearchInvoiceItem]
