from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.payment import PaymentResponse


class InvoiceLinePreviewResponse(BaseModel):
    product_id: Optional[int] = None
    description: str
    quantity: int
    unit_price: int  # in paise
    amount: int  # in paise
    discount_amount: int = 0
    tax_name: Optional[str] = None
    tax_rate: int = 0  # basis points
    tax_amount: int = 0  # in paise
    line_total: int = 0  # in paise


class InvoicePreviewResponse(BaseModel):
    subscription_id: int
    subscription_number: str
    period_start: date
    period_end: date
    invoice_date: date
    due_date: date
    subtotal: int
    discount_total: int
    applied_discount_id: Optional[int] = None
    applied_discount_name: Optional[str] = None
    tax_total: int
    total: int
    lines: List[InvoiceLinePreviewResponse]


class InvoiceLineResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    description: str
    quantity: int
    unit_price: int
    discount_amount: int
    tax_name: Optional[str] = None
    tax_rate: int
    tax_amount: int
    line_total: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(BaseModel):
    id: int
    number: str
    subscription_id: int
    customer_id: int
    customer_name: str
    company_name: str
    customer_email: str
    billing_address_line1: Optional[str] = None
    billing_address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None

    period_start: date
    period_end: date
    invoice_date: date
    due_date: date
    status: str

    subtotal: int
    discount_total: int
    tax_total: int
    total: int
    amount_paid: int
    balance: int

    applied_discount_id: Optional[int] = None
    discount_name: Optional[str] = None
    sent_at: Optional[datetime] = None

    is_overdue: bool
    days_overdue: int

    lines: List[InvoiceLineResponse] = []
    payments: List[PaymentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BillingRunRequest(BaseModel):
    as_of_date: Optional[date] = None
    subscription_ids: Optional[List[int]] = None
    dry_run: bool = False


class BillingRunFailure(BaseModel):
    subscription: str
    reason: str


class BillingRunResponse(BaseModel):
    due: int
    created: int
    already_billed: int
    failed: List[BillingRunFailure] = []
    total_amount: int


class BulkInvoiceActionRequest(BaseModel):
    action: str = Field(..., description="'confirm' or 'send'")
    invoice_ids: List[int] = Field(..., max_length=500)


class BulkInvoiceActionResult(BaseModel):
    invoice_id: int
    success: bool
    error: Optional[str] = None


class BulkInvoiceActionResponse(BaseModel):
    total_processed: int
    succeeded: int
    failed: int
    results: List[BulkInvoiceActionResult]
