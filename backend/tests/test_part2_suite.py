from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.catalog import DiscountRule, Plan, Product, TaxRule
from app.models.invoice import Invoice
from app.models.subscription import Subscription, SubscriptionLine


def test_preview_equals_generated_invoice_exact_match(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    today = date(2026, 7, 1)

    plan = Plan(name="Cloud Platform", price=150000, billing_period="monthly", min_quantity=1, is_active=True)
    product1 = Product(name="DB Node", type="software", sales_price=75000, is_active=True)
    product2 = Product(name="Backups", type="add_on", sales_price=25000, is_active=True)

    disc = DiscountRule(
        name="Launch Offer",
        type="percent",
        value=1500,  # 15%
        start_date=today - timedelta(days=5),
        end_date=today + timedelta(days=60),
        applies_to="subscription",
        is_active=True,
    )
    tax = TaxRule(name="GST 18", rate=1800, scope="all", is_active=True)

    db_session.add_all([plan, product1, product2, disc, tax])
    db_session.commit()

    # Create subscription
    res_sub = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": auth_tokens["c1_id"],
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "lines": [
                {"product_id": product1.id, "quantity": 1},
                {"product_id": product2.id, "quantity": 2},
            ],
        },
    )
    sub_id = res_sub.json()["id"]

    # Activate
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "quotation"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "confirmed"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "active"})

    # 1. Fetch preview
    res_prev = client.post(f"/api/subscriptions/{sub_id}/invoice-preview", headers=headers_staff)
    assert res_prev.status_code == 200
    preview = res_prev.json()

    # 2. Run billing
    res_bill = client.post(
        "/api/billing/run",
        headers=headers_staff,
        json={"as_of_date": today.isoformat(), "subscription_ids": [sub_id]},
    )
    assert res_bill.status_code == 200

    # 3. Fetch generated invoice from API
    inv = db_session.query(Invoice).filter(Invoice.subscription_id == sub_id).first()
    assert inv is not None
    res_inv = client.get(f"/api/invoices/{inv.id}", headers=headers_staff)
    assert res_inv.status_code == 200
    invoice = res_inv.json()

    # Assert exact equality between preview and generated invoice
    assert preview["subtotal"] == invoice["subtotal"]
    assert preview["discount_total"] == invoice["discount_total"]
    assert preview["tax_total"] == invoice["tax_total"]
    assert preview["total"] == invoice["total"]
    assert preview["period_start"] == invoice["period_start"]
    assert preview["period_end"] == invoice["period_end"]
    assert preview["applied_discount_id"] == invoice["applied_discount_id"]
    assert len(preview["lines"]) == len(invoice["lines"])

    for p_line, i_line in zip(preview["lines"], invoice["lines"]):
        assert p_line["description"] == i_line["description"]
        assert p_line["quantity"] == i_line["quantity"]
        assert p_line["unit_price"] == i_line["unit_price"]
        assert p_line["discount_amount"] == i_line["discount_amount"]
        assert p_line["tax_amount"] == i_line["tax_amount"]
        assert p_line["line_total"] == i_line["line_total"]


def test_invoice_cancellation_releases_discount_usage(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    today = date(2026, 8, 1)

    plan = Plan(name="Release Plan", price=50000, billing_period="monthly", min_quantity=1, is_active=True)
    product = Product(name="Core Server", type="software", sales_price=30000, is_active=True)
    disc = DiscountRule(
        name="Single Use Coupon",
        type="fixed",
        value=10000,
        start_date=today - timedelta(days=1),
        end_date=today + timedelta(days=30),
        usage_limit=1,
        used_count=0,
        applies_to="subscription",
        is_active=True,
    )
    db_session.add_all([plan, product, disc])
    db_session.commit()

    sub = Subscription(
        number="BL-RELEASE01",
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

    line = SubscriptionLine(subscription_id=sub.id, product_id=product.id, quantity=1, unit_price=30000, amount=30000)
    db_session.add(line)
    db_session.commit()

    # 1. Billing run uses the discount
    client.post("/api/billing/run", headers=headers_staff, json={"as_of_date": today.isoformat(), "subscription_ids": [sub.id]})
    db_session.refresh(disc)
    assert disc.used_count == 1

    # Fetch created draft invoice
    inv = db_session.query(Invoice).filter(Invoice.subscription_id == sub.id).first()
    assert inv.applied_discount_id == disc.id

    # 2. Cancel invoice releases discount
    res_cancel = client.post(f"/api/invoices/{inv.id}/cancel", headers=headers_staff)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"

    db_session.refresh(disc)
    assert disc.used_count == 0


def test_unique_subscription_period_start_database_constraint(db_session: Session, auth_tokens):
    today = date(2026, 9, 1)
    # Create invoice 1
    inv1 = Invoice(
        number="INV-2026-UQ001",
        subscription_id=1,
        customer_id=auth_tokens["c1_id"],
        customer_name="Customer",
        company_name="Corp",
        customer_email="c@example.com",
        period_start=today,
        period_end=today + timedelta(days=30),
        invoice_date=today,
        due_date=today,
        status="draft",
        subtotal=1000,
        discount_total=0,
        tax_total=0,
        total=1000,
        amount_paid=0,
        balance=1000,
    )
    db_session.add(inv1)
    db_session.commit()

    # Attempt to create duplicate invoice with same subscription_id and period_start
    inv2 = Invoice(
        number="INV-2026-UQ002",
        subscription_id=1,
        customer_id=auth_tokens["c1_id"],
        customer_name="Customer",
        company_name="Corp",
        customer_email="c@example.com",
        period_start=today,  # Duplicate!
        period_end=today + timedelta(days=30),
        invoice_date=today,
        due_date=today,
        status="draft",
        subtotal=1000,
        discount_total=0,
        tax_total=0,
        total=1000,
        amount_paid=0,
        balance=1000,
    )
    db_session.add(inv2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_part2_role_matrix(client: TestClient, auth_tokens):
    """Verifies that billing, invoices, and system endpoints enforce RBAC properly."""
    token_admin = auth_tokens["admin"]
    token_staff = auth_tokens["staff"]
    token_cust = auth_tokens["cust1"]

    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    headers_staff = {"Authorization": f"Bearer {token_staff}"}
    headers_cust = {"Authorization": f"Bearer {token_cust}"}
    headers_anon = {}

    # /api/billing/run
    assert client.post("/api/billing/run", headers=headers_anon, json={}).status_code == 401
    assert client.post("/api/billing/run", headers=headers_cust, json={}).status_code == 403
    assert client.post("/api/billing/run", headers=headers_staff, json={}).status_code == 200
    assert client.post("/api/billing/run", headers=headers_admin, json={}).status_code == 200

    # /api/system/run-daily (Admin only)
    assert client.post("/api/system/run-daily", headers=headers_anon, json={}).status_code == 401
    assert client.post("/api/system/run-daily", headers=headers_cust, json={}).status_code == 403
    assert client.post("/api/system/run-daily", headers=headers_staff, json={}).status_code == 403
    assert client.post("/api/system/run-daily", headers=headers_admin, json={}).status_code == 200
