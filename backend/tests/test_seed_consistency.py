from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.catalog import DiscountRule, Plan, Product, ProductVariant
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.user import User
from app.seed import run_seed


def test_seed_counts_and_business_rules(db_session: Session):
    today = date.today()
    # Run seed on test database session
    run_seed(size=200, reset=True, db=db_session)

    # 1. Customers
    cust_count = db_session.query(func.count(Customer.id)).scalar()
    assert cust_count == 300

    # 2. Products & Variants
    prod_count = db_session.query(func.count(Product.id)).scalar()
    assert prod_count == 12

    odoo_variant = (
        db_session.query(ProductVariant)
        .filter(ProductVariant.attribute == "Brand", ProductVariant.value == "Odoo")
        .first()
    )
    assert odoo_variant is not None
    assert odoo_variant.extra_price == 56000  # 560 INR

    # 3. Plans
    plan_count = db_session.query(func.count(Plan.id)).scalar()
    assert plan_count == 8

    # 4. Discounts
    disc_count = db_session.query(func.count(DiscountRule.id)).scalar()
    assert disc_count == 5

    # 5. Subscriptions
    sub_count = db_session.query(func.count(Subscription.id)).scalar()
    assert sub_count >= 200

    # 6. Invoices Integrity
    inv_count = db_session.query(func.count(Invoice.id)).scalar()
    assert inv_count > 0

    # Business rule: balance = total - amount_paid for all invoices
    invalid_balance_count = (
        db_session.query(func.count(Invoice.id))
        .filter(Invoice.balance != (Invoice.total - Invoice.amount_paid))
        .scalar()
    )
    assert invalid_balance_count == 0

    # Business rule: paid invoices have balance = 0
    invalid_paid_count = (
        db_session.query(func.count(Invoice.id))
        .filter(Invoice.status == "paid", Invoice.balance != 0)
        .scalar()
    )
    assert invalid_paid_count == 0

    # Business rule: no duplicate (subscription_id, period_start)
    duplicate_periods = (
        db_session.query(Invoice.subscription_id, Invoice.period_start)
        .group_by(Invoice.subscription_id, Invoice.period_start)
        .having(func.count(Invoice.id) > 1)
        .all()
    )
    assert len(duplicate_periods) == 0

    # 7. Payments
    pay_count = db_session.query(func.count(Payment.id)).scalar()
    assert pay_count > 0


def test_seed_logins_authentication(client: TestClient, db_session: Session):
    run_seed(size=20, reset=True, db=db_session)

    # Test Admin login
    res_admin = client.post("/api/auth/login", json={"email": "admin@brightloop.io", "password": "Admin@Brightloop2026"})
    assert res_admin.status_code == 200
    assert res_admin.json()["user"]["role"] == "admin"

    # Test Staff logins
    res_staff1 = client.post("/api/auth/login", json={"email": "staff1@brightloop.io", "password": "Staff@Brightloop2026"})
    assert res_staff1.status_code == 200
    assert res_staff1.json()["user"]["role"] == "staff"

    res_staff2 = client.post("/api/auth/login", json={"email": "staff2@brightloop.io", "password": "Staff@Brightloop2026"})
    assert res_staff2.status_code == 200
    assert res_staff2.json()["user"]["role"] == "staff"

    # Test Customer logins
    for i in range(1, 11):
        res_cust = client.post("/api/auth/login", json={"email": f"customer{i}@brightloop.io", "password": "Cust@Brightloop2026"})
        assert res_cust.status_code == 200
        assert res_cust.json()["user"]["role"] == "customer"
        assert res_cust.json()["user"]["customer_id"] == i
