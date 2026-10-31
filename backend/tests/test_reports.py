from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import Plan, Product
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.routers.reports import clear_reports_cache


def setup_deterministic_reports_data(db_session: Session, cust_id: int):
    today = date.today()

    # 1. Plans
    plan_m = Plan(name="Monthly Plan", price=100000, billing_period="monthly", min_quantity=1, is_active=True)
    plan_y = Plan(name="Yearly Plan", price=1200000, billing_period="yearly", min_quantity=1, is_active=True)
    prod_software = Product(name="Main Platform", type="software", sales_price=5000, is_active=True)
    prod_addon = Product(name="Extra Storage", type="add_on", sales_price=2000, is_active=True)
    db_session.add_all([plan_m, plan_y, prod_software, prod_addon])
    db_session.commit()

    # 2. Subscriptions
    # Active monthly: 100000 paise/mo
    sub1 = Subscription(
        number="BL-REP01",
        customer_id=cust_id,
        plan_id=plan_m.id,
        start_date=today - timedelta(days=60),
        expiry_date=today + timedelta(days=20),  # expiring within 30 days
        status="active",
        is_paused=False,
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=100000,
    )
    # Active yearly: 1200000 paise/yr -> 100000 paise/mo
    sub2 = Subscription(
        number="BL-REP02",
        customer_id=cust_id,
        plan_id=plan_y.id,
        start_date=today - timedelta(days=100),
        expiry_date=today + timedelta(days=200),
        status="active",
        is_paused=False,
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=1200000,
    )
    # Paused active monthly: 50000 paise -> excluded from MRR
    sub3 = Subscription(
        number="BL-REP03",
        customer_id=cust_id,
        plan_id=plan_m.id,
        start_date=today - timedelta(days=40),
        expiry_date=today + timedelta(days=120),
        status="active",
        is_paused=True,
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=50000,
    )
    # Closed subscription
    sub4 = Subscription(
        number="BL-REP04",
        customer_id=cust_id,
        plan_id=plan_m.id,
        start_date=today - timedelta(days=120),
        expiry_date=today - timedelta(days=10),
        status="closed",
        is_paused=False,
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=50000,
    )
    db_session.add_all([sub1, sub2, sub3, sub4])
    db_session.commit()

    cust = db_session.get(Customer, cust_id)

    # 3. Invoices
    # Invoice 1: Confirmed and Overdue (due date in past), total 15000, balance 15000
    inv1 = Invoice(
        number="INV-2026-REP01",
        subscription_id=sub1.id,
        customer_id=cust_id,
        customer_name=cust.name,
        company_name=cust.company_name,
        customer_email=cust.email,
        period_start=today - timedelta(days=40),
        period_end=today - timedelta(days=10),
        invoice_date=today - timedelta(days=15),
        due_date=today - timedelta(days=5),
        status="confirmed",
        subtotal=15000,
        discount_total=0,
        tax_total=0,
        total=15000,
        amount_paid=0,
        balance=15000,
    )
    # Invoice 2: Paid, total 20000 (split: 16000 software, 4000 addon)
    inv2 = Invoice(
        number="INV-2026-REP02",
        subscription_id=sub1.id,
        customer_id=cust_id,
        customer_name=cust.name,
        company_name=cust.company_name,
        customer_email=cust.email,
        period_start=today - timedelta(days=10),
        period_end=today + timedelta(days=20),
        invoice_date=today - timedelta(days=2),
        due_date=today + timedelta(days=10),
        status="paid",
        subtotal=20000,
        discount_total=0,
        tax_total=0,
        total=20000,
        amount_paid=20000,
        balance=0,
    )
    db_session.add_all([inv1, inv2])
    db_session.commit()

    # Lines for Invoice 2
    l1 = InvoiceLine(
        invoice_id=inv2.id,
        product_id=prod_software.id,
        description="Software Line",
        quantity=1,
        unit_price=16000,
        discount_amount=0,
        tax_amount=0,
        line_total=16000,
    )
    l2 = InvoiceLine(
        invoice_id=inv2.id,
        product_id=prod_addon.id,
        description="Addon Line",
        quantity=2,
        unit_price=2000,
        discount_amount=0,
        tax_amount=0,
        line_total=4000,
    )
    db_session.add_all([l1, l2])

    # Payment for Invoice 2: 20000 paise via UPI
    pay = Payment(
        invoice_id=inv2.id,
        method="upi",
        amount=20000,
        payment_date=today - timedelta(days=2),
        recorded_by=1,
    )
    db_session.add(pay)
    db_session.commit()
    clear_reports_cache()


def test_reports_summary_deterministic_calculations(client: TestClient, db_session: Session, auth_tokens):
    cust_id = auth_tokens["c1_id"]
    setup_deterministic_reports_data(db_session, cust_id)
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    today = date.today()

    res = client.get(
        f"/api/reports/summary?from={today - timedelta(days=30)}&to={today}",
        headers=headers_staff,
    )
    assert res.status_code == 200
    data = res.json()

    # Active subscriptions: sub1, sub2, sub3 = 3
    assert data["active_subscriptions"] == 3

    # MRR: sub1 (100000) + sub2 (1200000 / 12 = 100000) = 200000 paise. sub3 is paused so excluded.
    assert data["mrr"] == 200000

    # Revenue collected in range: 20000 paise
    assert data["revenue_collected"] == 20000
    assert data["payments_by_method"]["upi"] == 20000

    # Invoiced total in range: inv1 (15000) + inv2 (20000) = 35000 paise
    assert data["invoiced_total"] == 35000

    # Outstanding: inv1 is confirmed with balance 15000 -> amount 15000, count 1
    assert data["outstanding_amount"] == 15000
    assert data["outstanding_count"] == 1

    # Overdue: inv1 due date is today - 5, so overdue -> amount 15000, count 1
    assert data["overdue_amount"] == 15000
    assert data["overdue_count"] == 1

    # Expiring within 30 days: sub1 expires in 20 days -> count 1
    assert data["expiring_within_30_days"] == 1

    # Subscriptions by status: active=2, paused=1, closed=1
    assert data["subscriptions_by_status"]["active"] == 2
    assert data["subscriptions_by_status"]["paused"] == 1
    assert data["subscriptions_by_status"]["closed"] == 1

    # Invoices by status: confirmed=1, paid=1
    assert data["invoices_by_status"]["confirmed"] == 1
    assert data["invoices_by_status"]["paid"] == 1

    # Previous period structure exists
    assert "previous_period" in data
    assert "revenue_collected" in data["previous_period"]
    assert "invoiced_total" in data["previous_period"]


def test_reports_revenue_by_month_and_addon_split(client: TestClient, db_session: Session, auth_tokens):
    cust_id = auth_tokens["c1_id"]
    setup_deterministic_reports_data(db_session, cust_id)
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    res = client.get("/api/reports/revenue-by-month?months=8", headers=headers_staff)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) == 8

    current_month_str = date.today().strftime("%Y-%m")
    current_month_item = next((item for item in data["items"] if item["month"] == current_month_str), None)
    assert current_month_item is not None
    # From setup: Invoice 2 has 16000 software and 4000 addon
    assert current_month_item["subscription"] >= 16000
    assert current_month_item["addons"] >= 4000
    assert current_month_item["total"] == current_month_item["subscription"] + current_month_item["addons"]


def test_reports_rbac(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}

    # Admin and Staff allowed
    assert client.get("/api/reports/summary", headers=headers_admin).status_code == 200
    assert client.get("/api/reports/summary", headers=headers_staff).status_code == 200
    assert client.get("/api/reports/revenue-by-month", headers=headers_admin).status_code == 200
    assert client.get("/api/reports/revenue-by-month", headers=headers_staff).status_code == 200

    # Customer forbidden (403)
    assert client.get("/api/reports/summary", headers=headers_cust).status_code == 403
    assert client.get("/api/reports/revenue-by-month", headers=headers_cust).status_code == 403
