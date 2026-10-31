from datetime import date, timedelta
from fastapi.testclient import TestClient


def test_variant_pricing_exact_odoo_example(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    # 1. Admin creates product: sales price = 1000 rupees (100,000 paise)
    res = client.post(
        "/api/products",
        headers=headers_admin,
        json={
            "name": "ERP Core",
            "type": "software",
            "sales_price": 100000,
            "cost_price": 40000,
            "notes": "Base subscription",
        },
    )
    assert res.status_code == 201
    prod_id = res.json()["id"]

    # 2. Add variant: Brand = Odoo adds 560 rupees (56000 paise)
    res_var = client.post(
        f"/api/products/{prod_id}/variants",
        headers=headers_admin,
        json={
            "attribute": "Brand",
            "value": "Odoo",
            "extra_price": 56000,
        },
    )
    assert res_var.status_code == 201
    var_data = res_var.json()
    assert var_data["attribute"] == "Brand"
    assert var_data["value"] == "Odoo"
    assert var_data["extra_price"] == 56000
    # Effective price = sales_price (100000) + extra_price (56000) = 156000 paise (1560 INR)
    assert var_data["effective_price"] == 156000

    # 3. Staff reads product and sees effective price
    res_read = client.get(f"/api/products/{prod_id}", headers=headers_staff)
    assert res_read.status_code == 200
    assert len(res_read.json()["variants"]) == 1
    assert res_read.json()["variants"][0]["effective_price"] == 156000

    # 4. Duplicate variant (same attribute and value) returns 409
    res_dup = client.post(
        f"/api/products/{prod_id}/variants",
        headers=headers_admin,
        json={
            "attribute": "Brand",
            "value": "Odoo",
            "extra_price": 50000,
        },
    )
    assert res_dup.status_code == 409
    assert res_dup.json()["code"] == "VARIANT_ALREADY_EXISTS"

    # 5. Staff CANNOT create product (403)
    res_staff_create = client.post(
        "/api/products",
        headers=headers_staff,
        json={
            "name": "Staff Product",
            "type": "software",
            "sales_price": 10000,
            "cost_price": 5000,
        },
    )
    assert res_staff_create.status_code == 403


def test_plan_validation_and_crud(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    # 1. Validation failure: available_to before available_from -> 422
    res_invalid = client.post(
        "/api/plans",
        headers=headers_admin,
        json={
            "name": "Invalid Plan",
            "price": 299900,
            "billing_period": "monthly",
            "available_from": today.isoformat(),
            "available_to": yesterday.isoformat(),
        },
    )
    assert res_invalid.status_code == 422

    # 2. Valid plan creation
    res_valid = client.post(
        "/api/plans",
        headers=headers_admin,
        json={
            "name": "Pro Monthly",
            "price": 499900,
            "billing_period": "monthly",
            "min_quantity": 1,
            "available_from": today.isoformat(),
            "available_to": tomorrow.isoformat(),
            "auto_close": True,
            "closable": False,
            "pausable": True,
            "renewable": True,
        },
    )
    assert res_valid.status_code == 201
    plan_id = res_valid.json()["id"]

    # 3. Staff reads plans
    res_list = client.get("/api/plans", headers=headers_staff)
    assert res_list.status_code == 200
    assert any(p["id"] == plan_id for p in res_list.json()["items"])

    # 4. Staff cannot edit plan (403)
    res_staff_edit = client.put(f"/api/plans/{plan_id}", headers=headers_staff, json={"price": 100})
    assert res_staff_edit.status_code == 403


def test_tax_resolution_precedence(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    # Create two products: one software, one service
    res_sw = client.post(
        "/api/products",
        headers=headers_admin,
        json={"name": "Cloud App", "type": "software", "sales_price": 50000, "cost_price": 20000},
    )
    prod_sw_id = res_sw.json()["id"]

    res_srv = client.post(
        "/api/products",
        headers=headers_admin,
        json={"name": "Consulting", "type": "service", "sales_price": 80000, "cost_price": 30000},
    )
    prod_srv_id = res_srv.json()["id"]

    # 1. Level 1: Global "all" rule -> 1800 bp (18%)
    client.post(
        "/api/taxes",
        headers=headers_admin,
        json={"name": "GST All", "rate": 1800, "scope": "all"},
    )

    res_tax1 = client.get(f"/api/taxes/resolve/{prod_sw_id}", headers=headers_staff)
    assert res_tax1.status_code == 200
    assert res_tax1.json()["scope"] == "all"
    assert res_tax1.json()["rate"] == 1800

    # 2. Level 2: "product_type" rule for "software" -> 1200 bp (12%)
    client.post(
        "/api/taxes",
        headers=headers_admin,
        json={"name": "Software Tax", "rate": 1200, "scope": "product_type", "scope_value": "software"},
    )

    res_tax2 = client.get(f"/api/taxes/resolve/{prod_sw_id}", headers=headers_staff)
    assert res_tax2.status_code == 200
    # Software product resolves to product_type rule
    assert res_tax2.json()["scope"] == "product_type"
    assert res_tax2.json()["rate"] == 1200

    # Service product still resolves to "all" rule (1800)
    res_srv_tax = client.get(f"/api/taxes/resolve/{prod_srv_id}", headers=headers_staff)
    assert res_srv_tax.json()["scope"] == "all"
    assert res_srv_tax.json()["rate"] == 1800

    # 3. Level 3: "product" specific rule -> 500 bp (5%)
    client.post(
        "/api/taxes",
        headers=headers_admin,
        json={"name": "Special Cloud App Tax", "rate": 500, "scope": "product", "scope_value": str(prod_sw_id)},
    )

    res_tax3 = client.get(f"/api/taxes/resolve/{prod_sw_id}", headers=headers_staff)
    assert res_tax3.status_code == 200
    # Product rule beats product_type and all!
    assert res_tax3.json()["scope"] == "product"
    assert res_tax3.json()["rate"] == 500


def test_discount_status_computation(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    today = date.today()
    past = today - timedelta(days=10)
    future = today + timedelta(days=10)

    # 1. Scheduled discount (starts in future)
    res_sched = client.post(
        "/api/discounts",
        headers=headers_admin,
        json={
            "name": "Summer Promo",
            "type": "percent",
            "value": 1500,  # 15%
            "start_date": (today + timedelta(days=5)).isoformat(),
            "end_date": (today + timedelta(days=20)).isoformat(),
            "applies_to": "subscription",
        },
    )
    assert res_sched.status_code == 201
    assert res_sched.json()["status"] == "scheduled"

    # 2. Active discount (current date within range)
    res_active = client.post(
        "/api/discounts",
        headers=headers_admin,
        json={
            "name": "Live Promo",
            "type": "fixed",
            "value": 50000,  # 500 INR
            "start_date": past.isoformat(),
            "end_date": future.isoformat(),
            "usage_limit": 10,
            "applies_to": "subscription",
        },
    )
    assert res_active.status_code == 201
    assert res_active.json()["status"] == "active"

    # 3. Expired discount (end_date in past)
    res_expired = client.post(
        "/api/discounts",
        headers=headers_admin,
        json={
            "name": "Old Promo",
            "type": "fixed",
            "value": 10000,
            "start_date": (today - timedelta(days=20)).isoformat(),
            "end_date": (today - timedelta(days=5)).isoformat(),
            "applies_to": "subscription",
        },
    )
    assert res_expired.status_code == 201
    assert res_expired.json()["status"] == "expired"


def test_quotation_template_management_by_staff_and_admin(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    # Setup product with variant and plan
    res_p = client.post(
        "/api/products",
        headers=headers_admin,
        json={"name": "Database Server", "type": "software", "sales_price": 200000, "cost_price": 80000},
    )
    prod_id = res_p.json()["id"]

    res_v = client.post(
        f"/api/products/{prod_id}/variants",
        headers=headers_admin,
        json={"attribute": "Storage", "value": "1TB SSD", "extra_price": 50000},
    )
    var_id = res_v.json()["id"]

    res_plan = client.post(
        "/api/plans",
        headers=headers_admin,
        json={"name": "Enterprise Annual", "price": 1000000, "billing_period": "yearly"},
    )
    plan_id = res_plan.json()["id"]

    # Staff creates quotation template
    res_tmpl = client.post(
        "/api/quotation-templates",
        headers=headers_staff,
        json={
            "name": "Enterprise Package",
            "plan_id": plan_id,
            "validity_days": 45,
            "lines": [
                {
                    "product_id": prod_id,
                    "variant_id": var_id,
                    "quantity": 2,
                }
            ],
        },
    )
    assert res_tmpl.status_code == 201
    tmpl_data = res_tmpl.json()
    assert tmpl_data["name"] == "Enterprise Package"
    assert tmpl_data["plan_name"] == "Enterprise Annual"
    assert len(tmpl_data["lines"]) == 1
    # Unit price = 200000 + 50000 = 250000 paise
    assert tmpl_data["lines"][0]["unit_price"] == 250000
    assert tmpl_data["lines"][0]["quantity"] == 2
