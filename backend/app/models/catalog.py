from datetime import date, datetime
from typing import Optional
import pytz
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.config import settings
from app.core.database import Base

# Association table for DiscountRule <-> Product
discount_rule_products = Table(
    "discount_rule_products",
    Base.metadata,
    Column("discount_rule_id", Integer, ForeignKey("discount_rules.id", ondelete="CASCADE"), primary_key=True),
    Column("product_id", Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # "software", "add_on", "service"
    sales_price = Column(Integer, nullable=False, default=0)  # in paise
    cost_price = Column(Integer, nullable=False, default=0)  # in paise
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    discount_rules = relationship("DiscountRule", secondary=discount_rule_products, back_populates="products")


class ProductVariant(Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "attribute", "value", name="uq_product_variant_attr_val"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute = Column(String(100), nullable=False, index=True)
    value = Column(String(100), nullable=False, index=True)
    extra_price = Column(Integer, nullable=False, default=0)  # in paise

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    product = relationship("Product", back_populates="variants")

    @property
    def effective_price(self) -> int:
        return (self.product.sales_price if self.product else 0) + self.extra_price


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    price = Column(Integer, nullable=False, default=0)  # base recurring fee in paise
    billing_period = Column(String(50), nullable=False, index=True)  # daily, weekly, monthly, yearly
    min_quantity = Column(Integer, nullable=False, default=1)
    available_from = Column(Date, nullable=True, index=True)
    available_to = Column(Date, nullable=True, index=True)

    # 4 Plan flags
    auto_close = Column(Boolean, default=False, nullable=False)
    closable = Column(Boolean, default=True, nullable=False)
    pausable = Column(Boolean, default=True, nullable=False)
    renewable = Column(Boolean, default=True, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    quotation_templates = relationship("QuotationTemplate", back_populates="plan")


class TaxRule(Base):
    __tablename__ = "tax_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    rate = Column(Integer, nullable=False)  # basis points (e.g., 1800 for 18.00%)
    scope = Column(String(50), nullable=False, index=True)  # "all", "product_type", "product"
    scope_value = Column(String(100), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class DiscountRule(Base):
    __tablename__ = "discount_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # "fixed" or "percent"
    value = Column(Integer, nullable=False)  # fixed in paise, or percent in basis points (e.g. 1000 = 10%)
    min_purchase_amount = Column(Integer, nullable=True)  # in paise
    min_quantity = Column(Integer, nullable=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    usage_limit = Column(Integer, nullable=True)  # null means unlimited
    used_count = Column(Integer, default=0, nullable=False)
    applies_to = Column(String(50), nullable=False, index=True)  # "products" or "subscription"
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    products = relationship("Product", secondary=discount_rule_products, back_populates="discount_rules")

    def compute_status(self, today: Optional[date] = None) -> str:
        """
        Computed status: active, scheduled, expired, exhausted.
        Dates are calendar dates in APP_TIMEZONE.
        """
        if today is None:
            tz = pytz.timezone(settings.APP_TIMEZONE)
            today = datetime.now(tz).date()

        if not self.is_active:
            return "expired"
        if self.usage_limit is not None and self.used_count >= self.usage_limit:
            return "exhausted"
        if today < self.start_date:
            return "scheduled"
        if today > self.end_date:
            return "expired"
        return "active"


class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True)
    validity_days = Column(Integer, default=30, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    plan = relationship("Plan", back_populates="quotation_templates")
    lines = relationship("QuotationTemplateLine", back_populates="template", cascade="all, delete-orphan")


class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True, index=True)
    quantity = Column(Integer, default=1, nullable=False)

    template = relationship("QuotationTemplate", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")
