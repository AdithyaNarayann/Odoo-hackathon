from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import DiscountRule, Plan, Product, TaxRule
from app.models.invoice import Invoice
from app.models.subscription import Subscription, SubscriptionLine
from app.services.billing_period import compute_period_bounds


def test_month_end_billing_periods_no_drift():
    # Exact scenario: 31 Jan monthly
    start = date(2026, 1, 31)

    # Period 0: Jan 31 to Feb 27 (2026 is non-leap, next period starts Feb 28)
    p0_start, p0_end = compute_period_bounds(start, "monthly", 0)
    assert p0_start == date(2026, 1, 31)
    assert p0_end == date(2026, 2, 27)

    # Period 1: Feb 28 to Mar 30 (next period starts Mar 31)
    p1_start, p1_end = compute_period_bounds(start, "monthly", 1)
    assert p1_start == date(2026, 2, 28)
    assert p1_end == date(2026, 3, 30)

    # Period 2: Mar 31 to Apr 29 (next period starts Apr 30)
    p2_start, p2_end = compute_period_bounds(start, "monthly", 2)
    assert p2_start == date(2026, 3, 31)
    assert p2_end == date(2026, 4, 29)

    # Period 3: Apr 30 to May 30 (next period starts May 31)
    p3_start, p3_end = compute_period_bounds(start, "monthly", 3)
    assert p3_start == date(2026, 4, 30)
    assert p3_end == date(2026, 5, 30)

    # Period 4 snaps back to May 31!
    p4_start, p4_end = compute_period_bounds(start, "monthly", 4)
    assert p4_start == date(2026, 5, 31)


def test_billing_run_catchup_idempotency_and_paused_exclusion(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    today = date(2026, 4, 15)

    plan = Plan(name="Monthly Plan", price=50000, billing_period="monthly", min_quantity=1, is_active=True)
    product = Product(name="Server Instance", type="software", sales_price=20000, is_active=True)
    db_session.add_all([plan, product])
    db_session.commit()

    # Active subscription with start date 3 months ago (e.g. 2026-01-15)
    sub = Subscription(
        number="BL-CATCHUP01",
        customer_id=auth_tokens["c1_id"],
        plan_id=plan.id,
        start_date=date(2026, 1, 15),
        expiry_date=date(2026, 12, 31),
        status="active",
        next_billing_date=date(2026, 1, 15),
        created_by=1,
    )
    db_session.add(sub)
    db_session.flush()

    line = SubscriptionLine(subscription_id=sub.id, product_id=product.id, quantity=1, unit_price=20000, amount=20000)
    db_session.add(line)
    db_session.commit()

    # 1. Billing Run: catches up missed periods (Jan 15, Feb 15, Mar 15, Apr 15 = 4 periods)
    res_run1 = client.post(
        "/api/billing/run",
        headers=headers_staff,
        json={"as_of_date": today.isoformat(), "subscription_ids": [sub.id]},
    )
    assert res_run1.status_code == 200
    data1 = res_run1.json()
    assert data1["created"] == 4
    assert data1["due"] == 4
    assert data1["already_billed"] == 0

    # Verify 4 draft invoices created in DB
    invoices = db_session.query(Invoice).filter(Invoice.subscription_id == sub.id).order_by(Invoice.period_start.asc()).all()
    assert len(invoices) == 4
    assert invoices[0].period_start == date(2026, 1, 15)
    assert invoices[1].period_start == date(2026, 2, 15)
    assert invoices[2].period_start == date(2026, 3, 15)
    assert invoices[3].period_start == date(2026, 4, 15)

    # 2. Idempotency: Run again immediately -> creates 0, already_billed 4
    res_run2 = client.post(
        "/api/billing/run",
        headers=headers_staff,
        json={"as_of_date": today.isoformat(), "subscription_ids": [sub.id]},
    )
    assert res_run2.status_code == 200
    data2 = res_run2.json()
    assert data2["created"] == 0
    assert data2["already_billed"] == 4

    # 3. Paused subscription is NOT billed
    sub.is_paused = True
    db_session.commit()

    res_run_paused = client.post(
        "/api/billing/run",
        headers=headers_staff,
        json={"as_of_date": date(2026, 5, 20).isoformat(), "subscription_ids": [sub.id]},
    )
    assert res_run_paused.status_code == 200
    assert res_run_paused.json()["created"] == 0


def test_tax_resolved_at_invoice_time(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    today = date(2026, 6, 1)

    plan = Plan(name="Service Plan", price=0, billing_period="monthly", min_quantity=1, is_active=True)
    product = Product(name="Consulting Hours", type="service", sales_price=100000, is_active=True)
    db_session.add_all([plan, product])
    db_session.commit()

    sub = Subscription(
        number="BL-TAX01",
        customer_id=auth_tokens["c1_id"],
        plan_id=plan.id,
        start_date=today,
        expiry_date=today + timedelta(days=60),
        status="active",
        next_billing_date=today,
        created_by=1,
    )
    db_session.add(sub)
    db_session.flush()

    line = SubscriptionLine(subscription_id=sub.id, product_id=product.id, quantity=1, unit_price=100000, amount=100000)
    db_session.add(line)
    db_session.commit()

    # Admin creates 18% tax rule (1800 bp)
    client.post("/api/taxes", headers=headers_admin, json={"name": "GST 18", "rate": 1800, "scope": "all"})

    # Run billing
    res_bill = client.post(
        "/api/billing/run",
        headers=headers_staff,
        json={"as_of_date": today.isoformat(), "subscription_ids": [sub.id]},
    )
    assert res_bill.status_code == 200

    inv = db_session.query(Invoice).filter(Invoice.subscription_id == sub.id).first()
    assert inv is not None
    # 18% of 100000 paise is 18000 paise
    assert inv.tax_total == 18000
    assert inv.total == 118000


def test_invoice_actions_and_customer_visibility(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    headers_other_cust = {"Authorization": f"Bearer {auth_tokens['cust2']}"}
    today = date.today()

    # Create invoice in draft
    inv = Invoice(
        number="INV-2026-99999",
        subscription_id=1,
        customer_id=auth_tokens["c1_id"],
        customer_name="Customer One",
        company_name="Corp 1",
        customer_email="cust1@example.com",
        period_start=today,
        period_end=today + timedelta(days=30),
        invoice_date=today,
        due_date=today + timedelta(days=15),
        status="draft",
        subtotal=50000,
        discount_total=0,
        tax_total=0,
        total=50000,
        amount_paid=0,
        balance=50000,
    )
    db_session.add(inv)
    db_session.commit()

    # 1. Customer cannot see Draft invoice -> 404
    res_cust_draft = client.get(f"/api/invoices/{inv.id}", headers=headers_cust)
    assert res_cust_draft.status_code == 404

    # 2. Staff confirms invoice
    res_conf = client.post(f"/api/invoices/{inv.id}/confirm", headers=headers_staff)
    assert res_conf.status_code == 200
    assert res_conf.json()["status"] == "confirmed"

    # 3. Owning Customer CAN now see confirmed invoice
    res_cust_view = client.get(f"/api/invoices/{inv.id}", headers=headers_cust)
    assert res_cust_view.status_code == 200
    assert res_cust_view.json()["number"] == "INV-2026-99999"

    # 4. Foreign customer accessing this invoice strictly gets 404
    res_foreign = client.get(f"/api/invoices/{inv.id}", headers=headers_other_cust)
    assert res_foreign.status_code == 404

    # 5. Send invoice email
    res_send = client.post(f"/api/invoices/{inv.id}/send", headers=headers_staff)
    assert res_send.status_code == 200
    assert res_send.json()["sent_at"] is not None

    # 6. Bulk Action
    res_bulk = client.post(
        "/api/invoices/bulk-action",
        headers=headers_staff,
        json={"action": "send", "invoice_ids": [inv.id]},
    )
    assert res_bulk.status_code == 200
    assert res_bulk.json()["succeeded"] == 1

    # 7. Print invoice endpoint includes company details
    res_print = client.get(f"/api/invoices/{inv.id}/print", headers=headers_cust)
    assert res_print.status_code == 200
    assert "company" in res_print.json()
    assert "invoice" in res_print.json()
