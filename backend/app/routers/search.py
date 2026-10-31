from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.catalog import Plan
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.search import (
    SearchCustomerItem,
    SearchInvoiceItem,
    SearchResponse,
    SearchSubscriptionItem,
)

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResponse, summary="Global search across customers, subscriptions, and invoices")
def global_search(
    q: str = Query("", description="Search query string"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query_str = q.strip()
    if not query_str:
        return SearchResponse(customers=[], subscriptions=[], invoices=[])

    term = f"%{query_str}%"

    # 1. Customers Search
    cust_items: List[SearchCustomerItem] = []
    current_cust = None

    if current_user.role == "customer":
        current_cust = (
            db.query(Customer)
            .filter(Customer.user_id == current_user.id, Customer.is_active == True)
            .first()
        )
        if current_cust:
            # Check if term matches current customer's details
            matches = (
                query_str.lower() in current_cust.name.lower()
                or query_str.lower() in current_cust.company_name.lower()
                or query_str.lower() in current_cust.email.lower()
                or (current_cust.phone and query_str.lower() in current_cust.phone.lower())
            )
            if matches:
                cust_items.append(
                    SearchCustomerItem(
                        id=current_cust.id,
                        name=current_cust.name,
                        company_name=current_cust.company_name,
                        email=current_cust.email,
                        phone=current_cust.phone,
                    )
                )
    else:
        cust_matches = (
            db.query(Customer)
            .filter(
                Customer.is_active == True,
                or_(
                    Customer.name.ilike(term),
                    Customer.company_name.ilike(term),
                    Customer.email.ilike(term),
                    Customer.phone.ilike(term),
                ),
            )
            .order_by(Customer.name.asc())
            .limit(5)
            .all()
        )
        cust_items = [
            SearchCustomerItem(
                id=c.id,
                name=c.name,
                company_name=c.company_name,
                email=c.email,
                phone=c.phone,
            )
            for c in cust_matches
        ]

    # 2. Subscriptions Search
    sub_query = (
        db.query(Subscription)
        .join(Customer, Subscription.customer_id == Customer.id)
        .join(Plan, Subscription.plan_id == Plan.id)
        .options(joinedload(Subscription.customer), joinedload(Subscription.plan))
    )

    if current_user.role == "customer":
        if not current_cust:
            sub_matches = []
        else:
            sub_matches = (
                sub_query.filter(
                    Subscription.customer_id == current_cust.id,
                    Subscription.status != "draft",
                    or_(
                        Subscription.number.ilike(term),
                        Customer.name.ilike(term),
                        Customer.company_name.ilike(term),
                        Plan.name.ilike(term),
                    ),
                )
                .order_by(Subscription.id.desc())
                .limit(5)
                .all()
            )
    else:
        sub_matches = (
            sub_query.filter(
                or_(
                    Subscription.number.ilike(term),
                    Customer.name.ilike(term),
                    Customer.company_name.ilike(term),
                    Plan.name.ilike(term),
                )
            )
            .order_by(Subscription.id.desc())
            .limit(5)
            .all()
        )

    sub_items = [
        SearchSubscriptionItem(
            id=s.id,
            number=s.number,
            status=s.status,
            customer_id=s.customer_id,
            customer_name=s.customer.name if s.customer else "",
            plan_name=s.plan.name if s.plan else "",
            recurring_subtotal=s.recurring_subtotal,
        )
        for s in sub_matches
    ]

    # 3. Invoices Search
    inv_query = db.query(Invoice)

    if current_user.role == "customer":
        if not current_cust:
            inv_matches = []
        else:
            inv_matches = (
                inv_query.filter(
                    Invoice.customer_id == current_cust.id,
                    Invoice.status != "draft",
                    or_(
                        Invoice.number.ilike(term),
                        Invoice.customer_name.ilike(term),
                        Invoice.company_name.ilike(term),
                    ),
                )
                .order_by(Invoice.id.desc())
                .limit(5)
                .all()
            )
    else:
        inv_matches = (
            inv_query.filter(
                or_(
                    Invoice.number.ilike(term),
                    Invoice.customer_name.ilike(term),
                    Invoice.company_name.ilike(term),
                )
            )
            .order_by(Invoice.id.desc())
            .limit(5)
            .all()
        )

    inv_items = [
        SearchInvoiceItem(
            id=i.id,
            number=i.number,
            status=i.status,
            customer_id=i.customer_id,
            customer_name=i.customer_name,
            total=i.total,
            balance=i.balance,
            due_date=i.due_date,
        )
        for i in inv_matches
    ]

    return SearchResponse(
        customers=cust_items,
        subscriptions=sub_items,
        invoices=inv_items,
    )
