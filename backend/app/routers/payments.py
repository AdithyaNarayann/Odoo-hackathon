from datetime import date, datetime
from typing import Optional
import pytz
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import case, desc, func, or_, update
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.errors import (
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentListResponse,
    PaymentResponse,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])


def get_current_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


def build_payment_response(p: Payment, inv: Optional[Invoice] = None) -> PaymentResponse:
    invoice_obj = inv or p.invoice
    return PaymentResponse(
        id=p.id,
        invoice_id=p.invoice_id,
        invoice_number=invoice_obj.number if invoice_obj else None,
        customer_id=invoice_obj.customer_id if invoice_obj else None,
        customer_name=invoice_obj.customer_name if invoice_obj else None,
        method=p.method,
        amount=p.amount,
        payment_date=p.payment_date,
        note=p.note,
        recorded_by=p.recorded_by,
        created_at=p.created_at,
    )


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED, summary="Record a payment")
def record_payment(
    req: PaymentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "staff")),
):
    today = get_current_today()
    if req.payment_date > today:
        raise UnprocessableEntityException(
            detail="Payment date cannot be in the future.",
            code="PAYMENT_DATE_FUTURE",
        )

    inv = db.get(Invoice, req.invoice_id)
    if not inv:
        raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    if inv.status != "confirmed":
        raise ConflictException(
            detail=f"Only confirmed invoices can receive payments (current status: {inv.status}).",
            code="INVOICE_NOT_CONFIRMED",
        )

    if req.amount > inv.balance:
        raise ConflictException(
            detail=f"Payment amount ({req.amount}) exceeds invoice balance ({inv.balance}).",
            code="AMOUNT_EXCEEDS_BALANCE",
        )

    # In ONE transaction: conditional UPDATE on the invoice
    stmt = (
        update(Invoice)
        .where(
            Invoice.id == req.invoice_id,
            Invoice.status == "confirmed",
            Invoice.balance >= req.amount,
        )
        .values(
            amount_paid=Invoice.amount_paid + req.amount,
            balance=Invoice.balance - req.amount,
            status=case(
                (Invoice.balance - req.amount == 0, "paid"),
                else_="confirmed",
            ),
        )
    )
    res = db.execute(stmt)
    if res.rowcount == 0:
        db.rollback()
        raise ConflictException(
            detail="Payment could not be recorded: invoice balance changed or invoice is not confirmed.",
            code="CONCURRENT_PAYMENT_CONFLICT",
        )

    payment = Payment(
        invoice_id=req.invoice_id,
        method=req.method,
        amount=req.amount,
        payment_date=req.payment_date,
        note=req.note,
        recorded_by=current_user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    db.refresh(inv)

    return build_payment_response(payment, inv)


@router.get("", response_model=PaymentListResponse, summary="List payments with filters")
def list_payments(
    invoice_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    method: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Payment).join(Invoice, Payment.invoice_id == Invoice.id)

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id, Customer.is_active == True).first()
        if not cust:
            return PaymentListResponse(items=[], total=0, page=page, page_size=page_size)
        query = query.filter(Invoice.customer_id == cust.id)
    else:
        if customer_id is not None:
            query = query.filter(Invoice.customer_id == customer_id)

    if invoice_id is not None:
        query = query.filter(Payment.invoice_id == invoice_id)

    if method:
        query = query.filter(Payment.method == method)

    if from_date:
        query = query.filter(Payment.payment_date >= from_date)

    if to_date:
        query = query.filter(Payment.payment_date <= to_date)

    sort_map = {
        "payment_date": Payment.payment_date,
        "created_at": Payment.created_at,
        "amount": Payment.amount,
        "id": Payment.id,
    }
    col = sort_map.get(sort_by, Payment.created_at)
    query = query.order_by(desc(col) if sort_order.lower() == "desc" else col.asc())

    total = query.count()
    items = (
        query.options(joinedload(Payment.invoice))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaymentListResponse(
        items=[build_payment_response(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=PaymentResponse, summary="Get payment details")
def get_payment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Payment).options(joinedload(Payment.invoice)).filter(Payment.id == id).first()
    if not p:
        raise NotFoundException(detail="Payment not found", code="PAYMENT_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id, Customer.is_active == True).first()
        if not cust or not p.invoice or p.invoice.customer_id != cust.id:
            raise NotFoundException(detail="Payment not found", code="PAYMENT_NOT_FOUND")

    return build_payment_response(p)
