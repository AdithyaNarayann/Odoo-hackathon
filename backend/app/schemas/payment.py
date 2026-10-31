from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


PaymentMethodType = Literal["cash", "card", "upi", "bank_transfer", "cheque"]


class PaymentCreateRequest(BaseModel):
    invoice_id: int
    method: PaymentMethodType
    amount: int = Field(..., gt=0, description="Payment amount in integer paise")
    payment_date: date
    note: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    invoice_id: int
    invoice_number: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    method: str
    amount: int
    payment_date: date
    note: Optional[str] = None
    recorded_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentListResponse(BaseModel):
    items: List[PaymentResponse]
    total: int
    page: int
    page_size: int
