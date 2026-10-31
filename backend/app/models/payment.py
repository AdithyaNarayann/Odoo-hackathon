from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_method_payment_date", "method", "payment_date"),
        Index("ix_payments_invoice_id_payment_date", "invoice_id", "payment_date"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    method = Column(String(50), nullable=False, index=True)  # cash, card, upi, bank_transfer, cheque
    amount = Column(Integer, nullable=False)  # in paise
    payment_date = Column(Date, nullable=False, index=True)
    note = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    invoice = relationship("Invoice", back_populates="payments")
    recorder = relationship("User")
