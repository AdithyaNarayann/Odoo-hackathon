from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_subscriptions_status_plan_id", "status", "plan_id"),
        Index("ix_subscriptions_status_is_paused", "status", "is_paused"),
        Index("ix_subscriptions_customer_id_status", "customer_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    number = Column(String(50), unique=True, nullable=False, index=True)

    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True)

    start_date = Column(Date, nullable=False, index=True)
    expiry_date = Column(Date, nullable=False, index=True)
    payment_terms = Column(String(50), nullable=False, default="immediate", index=True)  # immediate, net_15, net_30, net_45
    status = Column(String(50), nullable=False, default="draft", index=True)  # draft, quotation, confirmed, active, closed
    next_billing_date = Column(Date, nullable=False, index=True)
    is_paused = Column(Boolean, default=False, nullable=False, index=True)

    quotation_valid_until = Column(Date, nullable=True, index=True)
    template_id = Column(Integer, ForeignKey("quotation_templates.id", ondelete="SET NULL"), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Denormalized: plan fee plus the sum of enabled lines, pre-tax, pre-discount
    recurring_subtotal = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer = relationship("Customer")
    plan = relationship("Plan")
    template = relationship("QuotationTemplate")
    creator = relationship("User", foreign_keys=[created_by])
    lines = relationship("SubscriptionLine", back_populates="subscription", cascade="all, delete-orphan")
    events = relationship("SubscriptionEvent", back_populates="subscription", cascade="all, delete-orphan", order_by="SubscriptionEvent.id.asc()")
    invoices = relationship("Invoice", back_populates="subscription")

    def recompute_recurring_subtotal(self) -> None:
        plan_price = self.plan.price if self.plan else 0
        lines_total = sum(line.amount for line in self.lines if line.enabled)
        self.recurring_subtotal = plan_price + lines_total


class SubscriptionLine(Base):
    __tablename__ = "subscription_lines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True, index=True)

    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)  # snapshot of sales_price + variant extra in paise
    amount = Column(Integer, nullable=False)  # quantity * unit_price
    enabled = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    subscription = relationship("Subscription", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")


class SubscriptionEvent(Base):
    __tablename__ = "subscription_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    note = Column(Text, nullable=True)

    subscription = relationship("Subscription", back_populates="events")
    actor = relationship("User")
