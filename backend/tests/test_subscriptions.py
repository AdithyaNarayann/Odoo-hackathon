from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalog import Plan, Product, ProductVariant
from app.models.customer import Customer
from app.models.subscription import Subscription


def setup_catalog_fixtures(db_session: Session):
    today = date.today()
    # Plan
    plan = Plan(
        name="Business Monthly",
        price=50000,  # 500 INR
        billing_period="monthly",
        min_quantity=2,
        available_from=today - timedelta(days=30),
        available_to=today + timedelta(days=365),
        auto_close=True,
        closable=True,
        pausable=True,
        renewable=True,
        is_active=True,
    )
    # Locked plan (cannot close, pause, or renew)
    rigid_plan = Plan(
        name="Rigid Plan",
        price=10000,
        billing_period="monthly",
        min_quantity=1,
        closable=False,
        pausable=False,
        renewable=False,
        is_active=True,
    )
    # Products
    software = Product(name="Core App", type="software", sales_price=10000, cost_price=2000, is_active=True)
    add_on = Product(name="Extra Storage", type="add_on", sales_price=5000, cost_price=1000, is_active=True)

    db_session.add_all([plan, rigid_plan, software, add_on])
    db_session.commit()
    return plan, rigid_plan, software, add_on


def test_subscription_creation_and_number_sequence(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    plan, _, software, _ = setup_catalog_fixtures(db_session)
    c1_id = auth_tokens["c1_id"]
    today = date.today()

    # 1. First subscription
    res1 = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": c1_id,
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "lines": [{"product_id": software.id, "quantity": 2}],
        },
    )
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["number"] == "BL-00001"
    assert data1["status"] == "draft"
    # Plan price (50000) + 2 * software price (2 * 10000) = 70000 paise
    assert data1["recurring_subtotal"] == 70000

    # 2. Second subscription gets next sequence
    res2 = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": c1_id,
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=180)).isoformat(),
            "lines": [{"product_id": software.id, "quantity": 3}],
        },
    )
    assert res2.status_code == 201
    assert res2.json()["number"] == "BL-00002"


def test_subscription_contract_locking(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    plan, _, software, _ = setup_catalog_fixtures(db_session)
    c1_id = auth_tokens["c1_id"]
    today = date.today()

    res = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": c1_id,
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "lines": [{"product_id": software.id, "quantity": 2}],
        },
    )
    sub_id = res.json()["id"]

    # In Draft: editable
    res_edit = client.put(f"/api/subscriptions/{sub_id}", headers=headers_staff, json={"notes": "Draft notes"})
    assert res_edit.status_code == 200

    # Move Draft -> Quotation -> Confirmed
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "quotation"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "confirmed"})

    # In Confirmed: contract is locked, PUT returns 409
    res_lock = client.put(f"/api/subscriptions/{sub_id}", headers=headers_staff, json={"notes": "Should fail"})
    assert res_lock.status_code == 409
    assert res_lock.json()["code"] == "CONTRACT_LOCKED"


def test_state_machine_legal_and_illegal_moves(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    plan, rigid_plan, software, _ = setup_catalog_fixtures(db_session)
    c1_id = auth_tokens["c1_id"]
    today = date.today()

    res = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": c1_id,
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "lines": [{"product_id": software.id, "quantity": 2}],
        },
    )
    sub_id = res.json()["id"]

    # 1. Illegal move: Draft directly to Active -> 409
    res_bad = client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "active"})
    assert res_bad.status_code == 409

    # 2. Draft -> Quotation
    res_q = client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "quotation"})
    assert res_q.status_code == 200
    assert res_q.json()["status"] == "quotation"
    assert res_q.json()["quotation_valid_until"] is not None

    # 3. Customer can confirm own quotation
    res_conf = client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_cust, json={"status": "confirmed"})
    assert res_conf.status_code == 200
    assert res_conf.json()["status"] == "confirmed"

    # 4. Customer CANNOT activate subscription -> 403
    res_cust_act = client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_cust, json={"status": "active"})
    assert res_cust_act.status_code == 403

    # 5. Staff activates -> 200
    res_act = client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "active"})
    assert res_act.status_code == 200
    assert res_act.json()["status"] == "active"


def test_pause_resume_and_renew(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    plan, rigid_plan, software, _ = setup_catalog_fixtures(db_session)
    c1_id = auth_tokens["c1_id"]
    today = date.today()

    # Active subscription with normal plan
    res = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": c1_id,
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=60)).isoformat(),
            "lines": [{"product_id": software.id, "quantity": 2}],
        },
    )
    sub_id = res.json()["id"]
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "quotation"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "confirmed"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "active"})

    # Pause
    res_pause = client.post(f"/api/subscriptions/{sub_id}/pause", headers=headers_staff)
    assert res_pause.status_code == 200
    assert res_pause.json()["is_paused"] is True

    # Set next_billing_date to the past to test resume logic
    sub = db_session.query(Subscription).filter(Subscription.id == sub_id).first()
    sub.next_billing_date = today - timedelta(days=10)
    db_session.commit()

    # Resume sets next_billing_date to today
    res_resume = client.post(f"/api/subscriptions/{sub_id}/resume", headers=headers_staff)
    assert res_resume.status_code == 200
    assert res_resume.json()["is_paused"] is False
    assert res_resume.json()["next_billing_date"] == today.isoformat()

    # Renew extends expiry by 1 month (plan.billing_period == monthly)
    old_expiry = date.fromisoformat(res_resume.json()["expiry_date"])
    res_renew = client.post(f"/api/subscriptions/{sub_id}/renew", headers=headers_staff, json={"periods": 2})
    assert res_renew.status_code == 200
    new_expiry = date.fromisoformat(res_renew.json()["expiry_date"])
    assert new_expiry > old_expiry


def test_addon_lines_on_active_subscription(client: TestClient, auth_tokens, db_session: Session):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    plan, _, software, add_on = setup_catalog_fixtures(db_session)
    c1_id = auth_tokens["c1_id"]
    today = date.today()

    res = client.post(
        "/api/subscriptions",
        headers=headers_staff,
        json={
            "customer_id": c1_id,
            "plan_id": plan.id,
            "start_date": today.isoformat(),
            "expiry_date": (today + timedelta(days=365)).isoformat(),
            "lines": [{"product_id": software.id, "quantity": 2}],
        },
    )
    sub_id = res.json()["id"]
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "quotation"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "confirmed"})
    client.post(f"/api/subscriptions/{sub_id}/status", headers=headers_staff, json={"status": "active"})

    # 1. Staff adds add-on line to active subscription
    res_add = client.post(
        f"/api/subscriptions/{sub_id}/lines/add-on",
        headers=headers_staff,
        json={"product_id": add_on.id, "quantity": 3},
    )
    assert res_add.status_code == 200
    sub_data = res_add.json()
    addon_line = [l for l in sub_data["lines"] if l["product_id"] == add_on.id][0]
    assert addon_line["quantity"] == 3
    assert addon_line["enabled"] is True

    # 2. Customer toggles add-on off
    res_toggle = client.patch(
        f"/api/subscriptions/{sub_id}/lines/{addon_line['id']}/toggle",
        headers=headers_cust,
        json={"enabled": False},
    )
    assert res_toggle.status_code == 200
    toggled_line = [l for l in res_toggle.json()["lines"] if l["id"] == addon_line["id"]][0]
    assert toggled_line["enabled"] is False
