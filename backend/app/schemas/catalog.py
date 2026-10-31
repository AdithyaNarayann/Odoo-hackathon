from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


# -------------------- Product & Variants --------------------

class ProductVariantCreate(BaseModel):
    attribute: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., min_length=1, max_length=100)
    extra_price: int = Field(0, description="Extra price in paise")


class ProductVariantUpdate(BaseModel):
    attribute: Optional[str] = Field(None, min_length=1, max_length=100)
    value: Optional[str] = Field(None, min_length=1, max_length=100)
    extra_price: Optional[int] = Field(None, description="Extra price in paise")


class ProductVariantResponse(BaseModel):
    id: int
    product_id: int
    attribute: str
    value: str
    extra_price: int
    effective_price: int

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: Literal["software", "add_on", "service"]
    sales_price: int = Field(0, ge=0, description="Sales price in paise")
    cost_price: int = Field(0, ge=0, description="Cost price in paise")
    notes: Optional[str] = None
    is_active: bool = True
    variants: Optional[List[ProductVariantCreate]] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[Literal["software", "add_on", "service"]] = None
    sales_price: Optional[int] = Field(None, ge=0)
    cost_price: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    type: str
    sales_price: int
    cost_price: int
    notes: Optional[str] = None
    is_active: bool
    variants: List[ProductVariantResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------- Plans --------------------

class PlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price: int = Field(0, ge=0, description="Base recurring fee per period in paise")
    billing_period: Literal["daily", "weekly", "monthly", "yearly"]
    min_quantity: int = Field(1, ge=1)
    available_from: Optional[date] = None
    available_to: Optional[date] = None
    auto_close: bool = False
    closable: bool = True
    pausable: bool = True
    renewable: bool = True
    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if self.available_from and self.available_to and self.available_to < self.available_from:
            raise ValueError("available_to must not be before available_from")
        return self


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[int] = Field(None, ge=0)
    billing_period: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = None
    min_quantity: Optional[int] = Field(None, ge=1)
    available_from: Optional[date] = None
    available_to: Optional[date] = None
    auto_close: Optional[bool] = None
    closable: Optional[bool] = None
    pausable: Optional[bool] = None
    renewable: Optional[bool] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.available_from and self.available_to and self.available_to < self.available_from:
            raise ValueError("available_to must not be before available_from")
        return self


class PlanResponse(BaseModel):
    id: int
    name: str
    price: int
    billing_period: str
    min_quantity: int
    available_from: Optional[date] = None
    available_to: Optional[date] = None
    auto_close: bool
    closable: bool
    pausable: bool
    renewable: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------- Tax Rules --------------------

class TaxRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    rate: int = Field(..., ge=0, description="Tax rate in basis points (e.g. 1800 for 18%)")
    scope: Literal["all", "product_type", "product"]
    scope_value: Optional[str] = Field(None, max_length=100)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_scope(self):
        if self.scope in ("product_type", "product") and not self.scope_value:
            raise ValueError(f"scope_value is required when scope is '{self.scope}'")
        return self


class TaxRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    rate: Optional[int] = Field(None, ge=0)
    scope: Optional[Literal["all", "product_type", "product"]] = None
    scope_value: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class TaxRuleResponse(BaseModel):
    id: int
    name: str
    rate: int
    scope: str
    scope_value: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaxResolveResponse(BaseModel):
    product_id: int
    product_name: str
    applicable_rule_id: Optional[int] = None
    applicable_rule_name: Optional[str] = None
    scope: Optional[str] = None
    rate: int  # in basis points


# -------------------- Discount Rules --------------------

class DiscountRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: Literal["fixed", "percent"]
    value: int = Field(..., ge=0, description="Fixed paise or percentage basis points")
    min_purchase_amount: Optional[int] = Field(None, ge=0)
    min_quantity: Optional[int] = Field(None, ge=1)
    start_date: date
    end_date: date
    usage_limit: Optional[int] = Field(None, ge=1)
    applies_to: Literal["products", "subscription"]
    product_ids: Optional[List[int]] = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_rule(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        if self.applies_to == "products" and not self.product_ids:
            raise ValueError("product_ids is required when applies_to is 'products'")
        return self


class DiscountRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[Literal["fixed", "percent"]] = None
    value: Optional[int] = Field(None, ge=0)
    min_purchase_amount: Optional[int] = Field(None, ge=0)
    min_quantity: Optional[int] = Field(None, ge=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    usage_limit: Optional[int] = Field(None, ge=1)
    applies_to: Optional[Literal["products", "subscription"]] = None
    product_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_rule(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class DiscountRuleResponse(BaseModel):
    id: int
    name: str
    type: str
    value: int
    min_purchase_amount: Optional[int] = None
    min_quantity: Optional[int] = None
    start_date: date
    end_date: date
    usage_limit: Optional[int] = None
    used_count: int
    applies_to: str
    product_ids: List[int] = []
    is_active: bool
    status: str  # active, scheduled, expired, exhausted
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------- Quotation Templates --------------------

class QuotationTemplateLineCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(1, ge=1)


class QuotationTemplateLineResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    variant_id: Optional[int] = None
    variant_label: Optional[str] = None
    quantity: int
    unit_price: int  # effective price in paise

    model_config = ConfigDict(from_attributes=True)


class QuotationTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    plan_id: int
    validity_days: int = Field(30, ge=1)
    lines: List[QuotationTemplateLineCreate] = []
    is_active: bool = True


class QuotationTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    plan_id: Optional[int] = None
    validity_days: Optional[int] = Field(None, ge=1)
    lines: Optional[List[QuotationTemplateLineCreate]] = None
    is_active: Optional[bool] = None


class QuotationTemplateResponse(BaseModel):
    id: int
    name: str
    plan_id: int
    plan_name: str
    validity_days: int
    is_active: bool
    lines: List[QuotationTemplateLineResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
