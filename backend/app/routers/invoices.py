from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
import pytz
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.invoice import (
    BulkInvoiceActionRequest,
    BulkInvoiceActionResult,
    BulkInvoiceActionResponse,
    InvoiceLineResponse,
    InvoiceResponse,
)
from app.schemas.payment import PaymentResponse
from app.services.email import send_email_sync
from app.services.pricing import release_discount_usage

router = APIRouter(
    prefix="/api/invoices",
    tags=["Invoices"],
)

WHITELISTED_SORT_COLUMNS = {
    "id": Invoice.id,
    "number": Invoice.number,
    "invoice_date": Invoice.invoice_date,
    "due_date": Invoice.due_date,
    "period_start": Invoice.period_start,
    "total": Invoice.total,
    "balance": Invoice.balance,
    "status": Invoice.status,
    "created_at": Invoice.created_at,
}


def get_current_today() -> date:
    tz = pytz.timezone(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


def build_invoice_response(inv: Invoice, today: Optional[date] = None) -> InvoiceResponse:
    if today is None:
        today = get_current_today()

    is_overdue = (inv.status == "confirmed" and inv.due_date < today and inv.balance > 0)
    days_overdue = (today - inv.due_date).days if is_overdue else 0

    lines_resp = [
        InvoiceLineResponse(
            id=l.id,
            product_id=l.product_id,
            description=l.description,
            quantity=l.quantity,
            unit_price=l.unit_price,
            discount_amount=l.discount_amount,
            tax_name=l.tax_name,
            tax_rate=l.tax_rate,
            tax_amount=l.tax_amount,
            line_total=l.line_total,
        )
        for l in inv.lines
    ]

    payments_resp = [
        PaymentResponse(
            id=p.id,
            invoice_id=p.invoice_id,
            invoice_number=inv.number,
            customer_id=inv.customer_id,
            customer_name=inv.customer_name,
            method=p.method,
            amount=p.amount,
            payment_date=p.payment_date,
            note=p.note,
            recorded_by=p.recorded_by,
            created_at=p.created_at,
        )
        for p in (inv.payments or [])
    ]

    return InvoiceResponse(
        id=inv.id,
        number=inv.number,
        subscription_id=inv.subscription_id,
        customer_id=inv.customer_id,
        customer_name=inv.customer_name,
        company_name=inv.company_name,
        customer_email=inv.customer_email,
        billing_address_line1=inv.billing_address_line1,
        billing_address_line2=inv.billing_address_line2,
        city=inv.city,
        state=inv.state,
        postal_code=inv.postal_code,
        country=inv.country,
        tax_id=inv.tax_id,
        period_start=inv.period_start,
        period_end=inv.period_end,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        status=inv.status,
        subtotal=inv.subtotal,
        discount_total=inv.discount_total,
        tax_total=inv.tax_total,
        total=inv.total,
        amount_paid=inv.amount_paid,
        balance=inv.balance,
        applied_discount_id=inv.applied_discount_id,
        discount_name=inv.discount_name,
        sent_at=inv.sent_at,
        is_overdue=is_overdue,
        days_overdue=days_overdue,
        lines=lines_resp,
        payments=payments_resp,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


def send_invoice_email(inv: Invoice, background_tasks: Optional[BackgroundTasks] = None) -> None:
    today = get_current_today()
    is_overdue = (inv.status == "confirmed" and inv.due_date < today and inv.balance > 0)

    if is_overdue:
        subject = f"[{settings.APP_NAME}] Payment Reminder: Invoice {inv.number} is overdue"
    else:
        subject = f"[{settings.APP_NAME}] Invoice {inv.number} from {settings.COMPANY_NAME}"

    portal_url = f"{settings.FRONTEND_URL}/portal/invoices/{inv.id}"
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; line-height: 1.5;">
        <h2>{'Payment Reminder: ' if is_overdue else ''}Invoice {inv.number}</h2>
        <p>Dear {inv.customer_name},</p>
        <p>Please find below the invoice summary for billing period <strong>{inv.period_start}</strong> to <strong>{inv.period_end}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{inv.number}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{inv.due_date}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Subtotal</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹{inv.subtotal / 100:.2f}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Discount</strong></td><td style="padding: 8px; border: 1px solid #ddd;">-₹{inv.discount_total / 100:.2f}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tax</strong></td><td style="padding: 8px; border: 1px solid #ddd;">+₹{inv.tax_total / 100:.2f}</td></tr>
          <tr style="background-color: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Amount</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><strong>₹{inv.total / 100:.2f}</strong></td></tr>
          <tr style="background-color: #fef2f2;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>Balance Due</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><strong>₹{inv.balance / 100:.2f}</strong></td></tr>
        </table>
        <p><a href="{portal_url}" style="background-color: #2563eb; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">View Invoice in Portal</a></p>
      </body>
    </html>
    """

    if background_tasks:
        background_tasks.add_task(send_email_sync, inv.customer_email, subject, html_body)
    else:
        send_email_sync(inv.customer_email, subject, html_body)


@router.get("", response_model=PaginatedResponse[InvoiceResponse], summary="List invoices with filters")
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    outstanding: Optional[bool] = Query(None),
    customer: Optional[int] = Query(None),
    subscription: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Invoice).options(joinedload(Invoice.lines))
    today = get_current_today()

    # Customer role filter: can ONLY see own Confirmed or Paid invoices
    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust:
            return PaginatedResponse[InvoiceResponse](items=[], total=0, page=page, page_size=page_size)
        query = query.filter(Invoice.customer_id == cust.id, Invoice.status.in_(["confirmed", "paid"]))
    else:
        if customer:
            query = query.filter(Invoice.customer_id == customer)
        if status:
            query = query.filter(Invoice.status == status.lower())

    if subscription:
        query = query.filter(Invoice.subscription_id == subscription)

    if outstanding is True:
        query = query.filter(Invoice.status == "confirmed", Invoice.balance > 0)

    if overdue is True:
        query = query.filter(Invoice.status == "confirmed", Invoice.due_date < today, Invoice.balance > 0)
    elif overdue is False:
        query = query.filter(or_(Invoice.status != "confirmed", Invoice.due_date >= today, Invoice.balance <= 0))

    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    if q:
        search_filter = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                Invoice.number.ilike(search_filter),
                Invoice.customer_name.ilike(search_filter),
                Invoice.company_name.ilike(search_filter),
            )
        )

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, Invoice.id)
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[InvoiceResponse](
        items=[build_invoice_response(item, today) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=InvoiceResponse, summary="Get invoice details")
def get_invoice(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(Invoice).options(joinedload(Invoice.lines)).filter(Invoice.id == id).first()
    if not inv:
        raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        # Customer: foreign or draft/cancelled invoices strictly return 404
        if not cust or inv.customer_id != cust.id or inv.status not in ("confirmed", "paid"):
            raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    return build_invoice_response(inv)


@router.post("/{id}/confirm", response_model=InvoiceResponse, summary="Confirm a draft invoice")
def confirm_invoice(
    id: int,
    current_user: User = Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    inv = db.query(Invoice).filter(Invoice.id == id).first()
    if not inv:
        raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    if inv.status != "draft":
        raise ConflictException(detail=f"Only draft invoices can be confirmed (current status: {inv.status}).", code="INVALID_STATUS")

    inv.status = "confirmed"
    db.commit()
    db.refresh(inv)
    return build_invoice_response(inv)


@router.post("/{id}/cancel", response_model=InvoiceResponse, summary="Cancel an unpaid invoice")
def cancel_invoice(
    id: int,
    current_user: User = Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    inv = db.query(Invoice).filter(Invoice.id == id).first()
    if not inv:
        raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    if inv.status not in ("draft", "confirmed"):
        raise ConflictException(detail=f"Cannot cancel invoice in status '{inv.status}'.", code="CANNOT_CANCEL")

    if inv.amount_paid > 0:
        raise ConflictException(detail="Cannot cancel an invoice with recorded payments.", code="HAS_PAYMENTS")

    inv.status = "cancelled"

    # Release discount usage if one was applied
    if inv.applied_discount_id is not None:
        release_discount_usage(db, inv.applied_discount_id)

    db.commit()
    db.refresh(inv)
    return build_invoice_response(inv)


@router.post("/{id}/send", response_model=InvoiceResponse, summary="Send invoice email to customer")
def send_invoice(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    inv = db.query(Invoice).filter(Invoice.id == id).first()
    if not inv:
        raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    if inv.status not in ("confirmed", "paid"):
        raise ConflictException(detail="Only confirmed or paid invoices can be sent to the customer.", code="INVOICE_NOT_CONFIRMED")

    send_invoice_email(inv, background_tasks=background_tasks)

    inv.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)
    return build_invoice_response(inv)


@router.get("/{id}/print", summary="Get full printable invoice with company details")
def print_invoice(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(Invoice).options(joinedload(Invoice.lines)).filter(Invoice.id == id).first()
    if not inv:
        raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    if current_user.role == "customer":
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust or inv.customer_id != cust.id or inv.status not in ("confirmed", "paid"):
            raise NotFoundException(detail="Invoice not found", code="INVOICE_NOT_FOUND")

    invoice_data = build_invoice_response(inv).model_dump()
    return {
        "company": {
            "name": settings.COMPANY_NAME,
            "address": settings.COMPANY_ADDRESS,
            "tax_id": settings.COMPANY_TAX_ID,
            "email": settings.COMPANY_EMAIL,
            "phone": settings.COMPANY_PHONE,
        },
        "invoice": invoice_data,
    }


@router.post("/bulk-action", response_model=BulkInvoiceActionResponse, summary="Bulk confirm or send invoices (up to 500)")
def bulk_invoice_action(
    payload: BulkInvoiceActionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles("admin", "staff")),
    db: Session = Depends(get_db),
):
    if len(payload.invoice_ids) > 500:
        raise BadRequestException(detail="Bulk action limit is 500 invoices per request.", code="LIMIT_EXCEEDED")

    results: List[BulkInvoiceActionResult] = []
    succeeded = 0
    failed = 0

    for inv_id in payload.invoice_ids:
        inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
        if not inv:
            results.append(BulkInvoiceActionResult(invoice_id=inv_id, success=False, error="Invoice not found"))
            failed += 1
            continue

        if payload.action == "confirm":
            if inv.status != "draft":
                results.append(BulkInvoiceActionResult(invoice_id=inv_id, success=False, error=f"Status is {inv.status}, not draft"))
                failed += 1
            else:
                inv.status = "confirmed"
                results.append(BulkInvoiceActionResult(invoice_id=inv_id, success=True))
                succeeded += 1

        elif payload.action == "send":
            if inv.status not in ("confirmed", "paid"):
                results.append(BulkInvoiceActionResult(invoice_id=inv_id, success=False, error=f"Status is {inv.status}, must be confirmed/paid"))
                failed += 1
            else:
                send_invoice_email(inv, background_tasks=background_tasks)
                inv.sent_at = datetime.now(timezone.utc)
                results.append(BulkInvoiceActionResult(invoice_id=inv_id, success=True))
                succeeded += 1
        else:
            results.append(BulkInvoiceActionResult(invoice_id=inv_id, success=False, error=f"Unknown action {payload.action}"))
            failed += 1

    db.commit()

    return BulkInvoiceActionResponse(
        total_processed=len(payload.invoice_ids),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )
