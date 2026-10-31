from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import Plan, Product
from app.models.customer import Customer
from app.models.subscription import Subscription
from app.services.scheduler import run_daily_maintenance


def test_daily_maintenance_activation_and_autoclose(db_session: Session):
    today = date.today()

    customer = Customer(
        name="Scheduler Test Customer",
        company_name="Sched Corp",
        email="sched@example.com",
        is_active=True,
    )
    # Plan with auto_close
    plan_auto = Plan(
        name="Auto Close Plan",
        price=10000,
        billing_period="monthly",
        min_quantity=1,
        auto_close=True,
        is_active=True,
    )
    # Plan without auto_close
    plan_manual = Plan(
        name="Manual Close Plan",
        price=10000,
        billing_period="monthly",
        min_quantity=1,
        auto_close=False,
        is_active=True,
    )
    product = Product(name="Item A", type="software", sales_price=5000, is_active=True)
    db_session.add_all([customer, plan_auto, plan_manual, product])
    db_session.commit()

    # Subscription 1: Confirmed with start_date <= today -> should activate
    sub_to_activate = Subscription(
        number="BL-ACT01",
        customer_id=customer.id,
        plan_id=plan_auto.id,
        start_date=today - timedelta(days=1),
        expiry_date=today + timedelta(days=30),
        status="confirmed",
        next_billing_date=today - timedelta(days=1),
        created_by=1,
        recurring_subtotal=10000,
    )

    # Subscription 2: Active with expiry_date < today and plan.auto_close -> should close
    sub_to_autoclose = Subscription(
        number="BL-CLS01",
        customer_id=customer.id,
        plan_id=plan_auto.id,
        start_date=today - timedelta(days=60),
        expiry_date=today - timedelta(days=1),
        status="active",
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=10000,
    )

    # Subscription 3: Active with expiry_date < today but plan.auto_close == False -> should remain active
    sub_keep_active = Subscription(
        number="BL-STAY01",
        customer_id=customer.id,
        plan_id=plan_manual.id,
        start_date=today - timedelta(days=60),
        expiry_date=today - timedelta(days=1),
        status="active",
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=10000,
    )

    db_session.add_all([sub_to_activate, sub_to_autoclose, sub_keep_active])
    db_session.commit()

    # Run maintenance pass 1
    res1 = run_daily_maintenance(db_session, as_of_date=today)
    assert res1["activated_count"] >= 1
    assert res1["auto_closed_count"] >= 1

    db_session.refresh(sub_to_activate)
    db_session.refresh(sub_to_autoclose)
    db_session.refresh(sub_keep_active)

    assert sub_to_activate.status == "active"
    assert sub_to_autoclose.status == "closed"
    assert sub_keep_active.status == "active"

    # Idempotency check: Run pass 2 on same date -> 0 activated, 0 closed
    res2 = run_daily_maintenance(db_session, as_of_date=today)
    assert res2["activated_count"] == 0
    assert res2["auto_closed_count"] == 0


def test_system_run_daily_endpoint_rbac(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}

    # Admin can trigger
    res_admin = client.post("/api/system/run-daily", headers=headers_admin, json={})
    assert res_admin.status_code == 200
    assert "activated_count" in res_admin.json()

    # Staff and Customer forbidden
    assert client.post("/api/system/run-daily", headers=headers_staff, json={}).status_code == 403
    assert client.post("/api/system/run-daily", headers=headers_cust, json={}).status_code == 403
