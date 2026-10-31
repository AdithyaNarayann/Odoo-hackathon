from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import Plan
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.subscription import Subscription


def test_global_search_empty_and_results(client: TestClient, db_session: Session, auth_tokens):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    # Empty search query
    res_empty = client.get("/api/search?q=", headers=headers_staff)
    assert res_empty.status_code == 200
    assert res_empty.json() == {"customers": [], "subscriptions": [], "invoices": []}

    # Create distinct searchable entities
    cust = Customer(
        name="Searchable Acme Corp",
        company_name="Acme Global Solutions",
        email="acme.search@example.com",
        phone="+919876543210",
        is_active=True,
    )
    plan = Plan(name="Search Standard Plan", price=10000, billing_period="monthly", min_quantity=1, is_active=True)
    db_session.add_all([cust, plan])
    db_session.commit()

    today = date.today()
    sub = Subscription(
        number="BL-SRCH99",
        customer_id=cust.id,
        plan_id=plan.id,
        start_date=today,
        expiry_date=today + timedelta(days=365),
        status="active",
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=10000,
    )
    db_session.add(sub)
    db_session.commit()

    inv = Invoice(
        number="INV-2026-SRCH99",
        subscription_id=sub.id,
        customer_id=cust.id,
        customer_name=cust.name,
        company_name=cust.company_name,
        customer_email=cust.email,
        period_start=today,
        period_end=today + timedelta(days=30),
        invoice_date=today,
        due_date=today + timedelta(days=15),
        status="confirmed",
        subtotal=10000,
        discount_total=0,
        tax_total=0,
        total=10000,
        amount_paid=0,
        balance=10000,
    )
    db_session.add(inv)
    db_session.commit()

    # Search by keyword "Acme"
    res_acme = client.get("/api/search?q=Acme", headers=headers_staff)
    assert res_acme.status_code == 200
    data_acme = res_acme.json()
    assert any(c["id"] == cust.id for c in data_acme["customers"])
    assert any(s["id"] == sub.id for s in data_acme["subscriptions"])
    assert any(i["id"] == inv.id for i in data_acme["invoices"])

    # Search by keyword "SRCH99"
    res_num = client.get("/api/search?q=SRCH99", headers=headers_staff)
    assert res_num.status_code == 200
    data_num = res_num.json()
    assert any(s["number"] == "BL-SRCH99" for s in data_num["subscriptions"])
    assert any(i["number"] == "INV-2026-SRCH99" for i in data_num["invoices"])


def test_global_search_customer_role_scoping(client: TestClient, db_session: Session, auth_tokens):
    headers_cust1 = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    headers_cust2 = {"Authorization": f"Bearer {auth_tokens['cust2']}"}
    cust1_id = auth_tokens["c1_id"]

    plan = Plan(name="Isolated Plan", price=10000, billing_period="monthly", min_quantity=1, is_active=True)
    db_session.add(plan)
    db_session.commit()

    today = date.today()
    sub = Subscription(
        number="BL-ISOLATE01",
        customer_id=cust1_id,
        plan_id=plan.id,
        start_date=today,
        expiry_date=today + timedelta(days=365),
        status="active",
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=10000,
    )
    db_session.add(sub)
    db_session.commit()

    cust1 = db_session.get(Customer, cust1_id)
    inv = Invoice(
        number="INV-2026-ISOLATE01",
        subscription_id=sub.id,
        customer_id=cust1_id,
        customer_name=cust1.name,
        company_name=cust1.company_name,
        customer_email=cust1.email,
        period_start=today,
        period_end=today + timedelta(days=30),
        invoice_date=today,
        due_date=today + timedelta(days=15),
        status="confirmed",
        subtotal=10000,
        discount_total=0,
        tax_total=0,
        total=10000,
        amount_paid=0,
        balance=10000,
    )
    db_session.add(inv)
    db_session.commit()

    # Customer 1 searches for their own entities
    res_c1 = client.get("/api/search?q=ISOLATE", headers=headers_cust1)
    assert res_c1.status_code == 200
    data_c1 = res_c1.json()
    assert any(s["number"] == "BL-ISOLATE01" for s in data_c1["subscriptions"])
    assert any(i["number"] == "INV-2026-ISOLATE01" for i in data_c1["invoices"])

    # Customer 2 searches for "ISOLATE" -> must NOT see Customer 1's records
    res_c2 = client.get("/api/search?q=ISOLATE", headers=headers_cust2)
    assert res_c2.status_code == 200
    data_c2 = res_c2.json()
    assert len(data_c2["customers"]) == 0
    assert len(data_c2["subscriptions"]) == 0
    assert len(data_c2["invoices"]) == 0
