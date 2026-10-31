from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import Plan, Product
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.subscription import Subscription


def create_sample_confirmed_invoice(db_session: Session, customer_id: int) -> Invoice:
    today = date.today()
    plan = Plan(
        name="Payments Test Plan",
        price=10000,
        billing_period="monthly",
        min_quantity=1,
        is_active=True,
    )
    product = Product(name="Widget", type="software", sales_price=5000, is_active=True)
    db_session.add_all([plan, product])
    db_session.commit()

    sub = Subscription(
        number="BL-PAY01",
        customer_id=customer_id,
        plan_id=plan.id,
        start_date=today,
        expiry_date=today + timedelta(days=365),
        status="active",
        next_billing_date=today,
        created_by=1,
        recurring_subtotal=15000,
    )
    db_session.add(sub)
    db_session.commit()

    cust = db_session.get(Customer, customer_id)

    inv = Invoice(
        number="INV-2026-PAY001",
        subscription_id=sub.id,
        customer_id=customer_id,
        customer_name=cust.name,
        company_name=cust.company_name,
        customer_email=cust.email,
        period_start=today,
        period_end=today + timedelta(days=30),
        invoice_date=today,
        due_date=today + timedelta(days=15),
        status="confirmed",
        subtotal=15000,
        discount_total=0,
        tax_total=0,
        total=15000,
        amount_paid=0,
        balance=15000,
    )
    db_session.add(inv)
    db_session.commit()
    db_session.refresh(inv)
    return inv


def test_payment_lifecycle_and_balance_tracking(client: TestClient, db_session: Session, auth_tokens):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    cust_id = auth_tokens["c1_id"]
    inv = create_sample_confirmed_invoice(db_session, cust_id)
    today = date.today()

    # Partial payment 1: 5000 paise
    res1 = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "card",
            "amount": 5000,
            "payment_date": str(today),
            "note": "Initial installment",
        },
    )
    assert res1.status_code == 201
    p1_data = res1.json()
    assert p1_data["amount"] == 5000
    assert p1_data["method"] == "card"

    # Verify invoice status is still confirmed, balance reduced to 10000
    res_inv1 = client.get(f"/api/invoices/{inv.id}", headers=headers_staff)
    assert res_inv1.status_code == 200
    inv1_data = res_inv1.json()
    assert inv1_data["status"] == "confirmed"
    assert inv1_data["amount_paid"] == 5000
    assert inv1_data["balance"] == 10000
    assert len(inv1_data["payments"]) == 1

    # Partial payment 2: 10000 paise (full remainder)
    res2 = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "upi",
            "amount": 10000,
            "payment_date": str(today),
            "note": "Settlement",
        },
    )
    assert res2.status_code == 201

    # Verify invoice status transitions to paid
    res_inv2 = client.get(f"/api/invoices/{inv.id}", headers=headers_staff)
    assert res_inv2.status_code == 200
    inv2_data = res_inv2.json()
    assert inv2_data["status"] == "paid"
    assert inv2_data["amount_paid"] == 15000
    assert inv2_data["balance"] == 0
    assert len(inv2_data["payments"]) == 2


def test_payment_validation_rules(client: TestClient, db_session: Session, auth_tokens):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    cust_id = auth_tokens["c1_id"]
    inv = create_sample_confirmed_invoice(db_session, cust_id)
    today = date.today()

    # Rule 1: Future payment date rejected (422)
    res_future = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "bank_transfer",
            "amount": 1000,
            "payment_date": str(today + timedelta(days=2)),
        },
    )
    assert res_future.status_code == 422

    # Rule 2: Amount exceeds balance rejected (409)
    res_excess = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "cash",
            "amount": 20000,
            "payment_date": str(today),
        },
    )
    assert res_excess.status_code == 409

    # Rule 3: Zero or negative amount rejected (422)
    res_zero = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "cash",
            "amount": 0,
            "payment_date": str(today),
        },
    )
    assert res_zero.status_code == 422

    # Rule 4: Payment on draft or paid invoice rejected
    inv.status = "draft"
    db_session.commit()
    res_draft = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "cheque",
            "amount": 5000,
            "payment_date": str(today),
        },
    )
    assert res_draft.status_code == 409


def test_payment_rbac_and_customer_visibility(client: TestClient, db_session: Session, auth_tokens):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust1 = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    headers_cust2 = {"Authorization": f"Bearer {auth_tokens['cust2']}"}
    cust1_id = auth_tokens["c1_id"]
    today = date.today()

    inv = create_sample_confirmed_invoice(db_session, cust1_id)

    # Customer 1 cannot record payments directly (403)
    res_cust_rec = client.post(
        "/api/payments",
        headers=headers_cust1,
        json={
            "invoice_id": inv.id,
            "method": "upi",
            "amount": 5000,
            "payment_date": str(today),
        },
    )
    assert res_cust_rec.status_code == 403

    # Staff records payment
    res_rec = client.post(
        "/api/payments",
        headers=headers_staff,
        json={
            "invoice_id": inv.id,
            "method": "upi",
            "amount": 5000,
            "payment_date": str(today),
        },
    )
    assert res_rec.status_code == 201
    pay_id = res_rec.json()["id"]

    # Customer 1 sees payment inside their invoice detail
    res_inv_cust1 = client.get(f"/api/invoices/{inv.id}", headers=headers_cust1)
    assert res_inv_cust1.status_code == 200
    assert len(res_inv_cust1.json()["payments"]) == 1

    # Customer 1 sees payment in /api/payments
    res_list_cust1 = client.get("/api/payments", headers=headers_cust1)
    assert res_list_cust1.status_code == 200
    assert any(p["id"] == pay_id for p in res_list_cust1.json()["items"])

    # Customer 2 gets 404 viewing Customer 1's invoice
    assert client.get(f"/api/invoices/{inv.id}", headers=headers_cust2).status_code == 404

    # Customer 2 does NOT see Customer 1's payments in /api/payments
    res_list_cust2 = client.get("/api/payments", headers=headers_cust2)
    assert res_list_cust2.status_code == 200
    assert not any(p["id"] == pay_id for p in res_list_cust2.json()["items"])

    # Customer 2 gets 404 accessing Customer 1's payment directly
    assert client.get(f"/api/payments/{pay_id}", headers=headers_cust2).status_code == 404


def test_concurrent_payment_prevention_of_overpayment(client: TestClient, db_session: Session, auth_tokens):
    import concurrent.futures

    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    cust_id = auth_tokens["c1_id"]
    inv = create_sample_confirmed_invoice(db_session, cust_id)  # Total 15000 paise
    today = date.today()

    def attempt_payment(amount: int):
        return client.post(
            "/api/payments",
            headers=headers_staff,
            json={
                "invoice_id": inv.id,
                "method": "upi",
                "amount": amount,
                "payment_date": str(today),
            },
        )

    # Two requests each attempting 10,000 paise on 15,000 balance
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_payment, 10000)
        f2 = executor.submit(attempt_payment, 10000)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1.status_code, res2.status_code]
    assert 201 in statuses
    assert 409 in statuses

    # Verify database state integrity
    db_session.refresh(inv)
    assert inv.amount_paid == 10000
    assert inv.balance == 5000
    assert inv.status == "confirmed"

