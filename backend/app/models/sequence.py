from sqlalchemy import Column, Integer, String, func
from sqlalchemy.orm import Session
from app.core.database import Base


class SequenceCounter(Base):
    __tablename__ = "sequence_counters"

    name = Column(String(50), primary_key=True, index=True)
    current_value = Column(Integer, nullable=False, default=0)


def get_next_sequence_value(db: Session, sequence_name: str) -> int:
    """
    Atomically retrieves and increments sequence counter.
    Works portably across SQLite and PostgreSQL.
    """
    counter = db.query(SequenceCounter).filter(SequenceCounter.name == sequence_name).with_for_update().first()
    if not counter:
        counter = SequenceCounter(name=sequence_name, current_value=1)
        db.add(counter)
        db.flush()
        return 1

    counter.current_value += 1
    db.flush()
    return counter.current_value


def get_next_subscription_number(db: Session) -> str:
    """Returns next subscription number like BL-00001."""
    val = get_next_sequence_value(db, "subscription")
    return f"BL-{val:05d}"


def get_next_invoice_number(db: Session, year: int) -> str:
    """Returns next invoice number like INV-2026-00001 per year."""
    seq_name = f"invoice_{year}"
    counter = db.query(SequenceCounter).filter(SequenceCounter.name == seq_name).with_for_update().first()
    if not counter:
        from app.models.invoice import Invoice
        prefix = f"INV-{year}-"
        max_num = db.query(func.max(Invoice.number)).filter(Invoice.number.like(f"{prefix}%")).scalar()
        init_val = 0
        if max_num:
            try:
                init_val = int(max_num.split("-")[-1])
            except Exception:
                init_val = 0
        counter = SequenceCounter(name=seq_name, current_value=init_val + 1)
        db.add(counter)
        db.flush()
        val = counter.current_value
    else:
        counter.current_value += 1
        db.flush()
        val = counter.current_value
    return f"INV-{year}-{val:05d}"
