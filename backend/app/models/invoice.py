from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("subscription_id", "period_start", name="uq_invoice_subscription_period"),
        Index("ix_invoices_status_due_date", "status", "due_date"),
        Index("ix_invoices_status_invoice_date", "status", "invoice_date"),
        Index("ix_invoices_customer_id_status", "customer_id", "status"),
        Index("ix_invoices_status_balance", "status", "balance"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    number = Column(String(50), unique=True, nullable=False, index=True)

    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Customer snapshot
    customer_name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False)
    billing_address_line1 = Column(String(255), nullable=True)
    billing_address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    tax_id = Column(String(50), nullable=True)

    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False, index=True)
    invoice_date = Column(Date, nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)

    status = Column(String(50), nullable=False, default="draft", index=True)  # draft, confirmed, paid, cancelled

    subtotal = Column(Integer, nullable=False)  # in paise
    discount_total = Column(Integer, nullable=False, default=0)  # in paise
    tax_total = Column(Integer, nullable=False, default=0)  # in paise
    total = Column(Integer, nullable=False)  # in paise
    amount_paid = Column(Integer, nullable=False, default=0)  # in paise
    balance = Column(Integer, nullable=False)  # in paise

    applied_discount_id = Column(Integer, ForeignKey("discount_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    discount_name = Column(String(255), nullable=True)

    sent_at = Column(DateTime(timezone=True), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    subscription = relationship("Subscription", back_populates="invoices")
    customer = relationship("Customer")
    applied_discount = relationship("DiscountRule")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceLine.id.asc()")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan", order_by="Payment.id.asc()")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    __table_args__ = (
        Index("ix_invoice_lines_invoice_product", "invoice_id", "product_id"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    description = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)  # in paise
    discount_amount = Column(Integer, nullable=False, default=0)  # in paise
    tax_name = Column(String(255), nullable=True)
    tax_rate = Column(Integer, nullable=False, default=0)  # basis points snapshot
    tax_amount = Column(Integer, nullable=False, default=0)  # in paise
    line_total = Column(Integer, nullable=False)  # in paise

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="lines")
    product = relationship("Product")
