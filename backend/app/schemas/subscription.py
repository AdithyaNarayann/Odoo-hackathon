from datetime import date, datetime
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SubscriptionLineCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(1, ge=1)


class SubscriptionLineResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_type: str
    variant_id: Optional[int] = None
    variant_label: Optional[str] = None
    quantity: int
    unit_price: int  # in paise
    amount: int  # in paise
    enabled: bool
    current_tax_rate: int  # in basis points

    model_config = ConfigDict(from_attributes=True)


class SubscriptionEventResponse(BaseModel):
    id: int
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    action: str
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    timestamp: datetime
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SubscriptionCreate(BaseModel):
    customer_id: int
    plan_id: int
    start_date: date
    expiry_date: date
    payment_terms: Literal["immediate", "net_15", "net_30", "net_45"] = "immediate"
    template_id: Optional[int] = None
    notes: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.expiry_date < self.start_date:
            raise ValueError("expiry_date must not be before start_date")
        return self


class SubscriptionCreateFromTemplate(BaseModel):
    customer_id: int
    template_id: int
    start_date: date
    expiry_date: Optional[date] = None
    payment_terms: Literal["immediate", "net_15", "net_30", "net_45"] = "immediate"
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    payment_terms: Optional[Literal["immediate", "net_15", "net_30", "net_45"]] = None
    notes: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.expiry_date and self.expiry_date < self.start_date:
            raise ValueError("expiry_date must not be before start_date")
        return self


class SubscriptionResponse(BaseModel):
    id: int
    number: str
    customer_id: int
    customer_name: str
    customer_company: str
    plan_id: int
    plan_name: str
    plan_price: int
    plan_billing_period: str
    start_date: date
    expiry_date: date
    payment_terms: str
    status: str
    next_billing_date: date
    is_paused: bool
    quotation_valid_until: Optional[date] = None
    template_id: Optional[int] = None
    notes: Optional[str] = None
    recurring_subtotal: int
    lines: List[SubscriptionLineResponse] = []
    events: List[SubscriptionEventResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubscriptionCardResponse(BaseModel):
    id: int
    number: str
    customer_name: str
    company_name: str
    plan_name: str
    status: str
    recurring_subtotal: int
    start_date: date
    expiry_date: date
    next_billing_date: date
    is_paused: bool


class SubscriptionBoardColumn(BaseModel):
    total_count: int
    cards: List[SubscriptionCardResponse]


class SubscriptionBoardResponse(BaseModel):
    draft: SubscriptionBoardColumn
    quotation: SubscriptionBoardColumn
    confirmed: SubscriptionBoardColumn
    active: SubscriptionBoardColumn
    closed: SubscriptionBoardColumn


class RenewSubscriptionRequest(BaseModel):
    periods: int = Field(1, ge=1, le=36, description="Number of billing periods to extend expiry_date")
