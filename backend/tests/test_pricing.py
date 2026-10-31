from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import DiscountRule, Plan, Product, TaxRule
from app.models.subscription import Subscription, SubscriptionLine
from app.services.pricing import (
    calculate_pricing,
    release_discount_usage,
    try_claim_discount_usage,
)


def test_pricing_pipeline_discount_selection_and_no_stacking(db_session: Session):
    today = date.today()

    # Plan with price
    plan = Plan(name="Gold Plan", price=100000, billing_period="monthly", min_quantity=1, is_active=True)
    prod1 = Product(name="App Suite", type="software", sales_price=50000, is_active=True)
    prod2 = Product(name="Cloud Storage", type="add_on", sales_price=30000, is_active=True)
    db_session.add_all([plan, prod1, prod2])
    db_session.commit()

    # Discount 1: 10% on subscription -> on (100000 + 50000 + 30000 = 180000), saving is 18000 paise
    disc_sub = DiscountRule(
        name="10% Sub Discount",
        type="percent",
        value=1000,  # 10.00%
        start_date=today - timedelta(days=1),
        end_date=today + timedelta(days=30),
        applies_to="subscription",
        is_active=True,
    )

    # Discount 2: fixed 25000 paise on products only -> on (50000 + 30000 = 80000), saving is 25000 paise
    disc_prod = DiscountRule(
        name="250 Fixed Product Discount",
        type="fixed",
        value=25000,
        start_date=today - timedelta(days=1),
        end_date=today + timedelta(days=30),
        applies_to="products",
        is_active=True,
    )
    disc_prod.products.extend([prod1, prod2])

    # Global tax 18% (1800 bp)
    tax = TaxRule(name="GST 18%", rate=1800, scope="all", is_active=True)

    db_session.add_all([disc_sub, disc_prod, tax])
    db_session.commit()

    sub = Subscription(
        number="BL-PRICING01",
        customer_id=1,
        plan_id=plan.id,
        start_date=today,
        expiry_date=today + timedelta(days=365),
        status="active",
        next_billing_date=today,
        created_by=1,
    )
    db_session.add(sub)
    db_session.flush()

    line1 = SubscriptionLine(subscription_id=sub.id, product_id=prod1.id, quantity=1, unit_price=50000, amount=50000)
    line2 = SubscriptionLine(subscription_id=sub.id, product_id=prod2.id, quantity=1, unit_price=30000, amount=30000)
    db_session.add_all([line1, line2])
    db_session.commit()

    # Calculate pricing
    res = calculate_pricing(sub, today=today, db=db_session)

    # Subtotal: Plan (100000) + Line1 (50000) + Line2 (30000) = 180000
    assert res.subtotal == 180000

    # Best discount: disc_prod (25000 saving) beats disc_sub (18000 saving)
    assert res.applied_discount.id == disc_prod.id
    assert res.discount_total == 25000

    # Total equals sum of line totals exactly
    assert sum(l.line_total for l in res.lines) == res.total
    assert res.total == res.subtotal - res.discount_total + res.tax_total


def test_atomic_discount_usage_counter(db_session: Session):
    today = date.today()
    rule = DiscountRule(
        name="Limited Discount",
        type="fixed",
        value=5000,
        start_date=today,
        end_date=today + timedelta(days=10),
        usage_limit=1,
        used_count=0,
        applies_to="subscription",
        is_active=True,
    )
    db_session.add(rule)
    db_session.commit()

    # Claim 1 -> True
    assert try_claim_discount_usage(db_session, rule.id) is True
    db_session.refresh(rule)
    assert rule.used_count == 1

    # Claim 2 -> False (limit reached)
    assert try_claim_discount_usage(db_session, rule.id) is False

    # Release 1 -> used_count goes back to 0
    release_discount_usage(db_session, rule.id)
    db_session.refresh(rule)
    assert rule.used_count == 0


def test_invoice_preview_endpoint(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    today = date.today()

    plan = Plan(name="Preview Plan", price=20000, billing_period="monthly", min_quantity=1, is_active=True)
    product = Product(name="Preview Product", type="software", sales_price=40000, is_active=True)
    db_session.add_all([plan, product])
    db_session.commit()

    res_sub = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": auth_tokens["c1_id"],
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "lines": [{"product_id": product.id, "quantity": 1}],
        },
    )
    sub_id = res_sub.json()["id"]

    # Preview next invoice
    res_prev = client.post(f"/api/subscriptions/{sub_id}/invoice-preview", headers=headers_staff)
    assert res_prev.status_code == 200
    prev_data = res_prev.json()
    assert prev_data["subtotal"] == 60000  # 20000 plan + 40000 product
    assert len(prev_data["lines"]) == 2
    assert prev_data["lines"][0]["description"] == "Plan: Preview Plan"
    assert prev_data["lines"][1]["description"] == "Preview Product"
