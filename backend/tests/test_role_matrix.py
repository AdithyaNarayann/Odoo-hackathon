import pytest
from fastapi.testclient import TestClient


def test_complete_role_route_matrix(client: TestClient, auth_tokens):
    """
    Exhaustively tests the role permission matrix across all route groups:
    - Unauthenticated
    - Customer
    - Staff
    - Admin
    """
    token_admin = auth_tokens["admin"]
    token_staff = auth_tokens["staff"]
    token_cust = auth_tokens["cust1"]

    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    headers_staff = {"Authorization": f"Bearer {token_staff}"}
    headers_cust = {"Authorization": f"Bearer {token_cust}"}
    headers_anon = {}

    # 1. /api/config/company
    assert client.get("/api/config/company", headers=headers_anon).status_code == 401
    assert client.get("/api/config/company", headers=headers_cust).status_code == 200
    assert client.get("/api/config/company", headers=headers_staff).status_code == 200
    assert client.get("/api/config/company", headers=headers_admin).status_code == 200

    # 2. /api/staff (Admin only)
    assert client.get("/api/staff", headers=headers_anon).status_code == 401
    assert client.get("/api/staff", headers=headers_cust).status_code == 403
    assert client.get("/api/staff", headers=headers_staff).status_code == 403
    assert client.get("/api/staff", headers=headers_admin).status_code == 200

    # 3. /api/customers (Admin and Staff)
    assert client.get("/api/customers", headers=headers_anon).status_code == 401
    assert client.get("/api/customers", headers=headers_cust).status_code == 403
    assert client.get("/api/customers", headers=headers_staff).status_code == 200
    assert client.get("/api/customers", headers=headers_admin).status_code == 200

    # 4. /api/portal/me (Customer only)
    assert client.get("/api/portal/me", headers=headers_anon).status_code == 401
    assert client.get("/api/portal/me", headers=headers_cust).status_code == 200
    assert client.get("/api/portal/me", headers=headers_staff).status_code == 403
    assert client.get("/api/portal/me", headers=headers_admin).status_code == 403

    # 5. /api/products
    # Reads: Admin & Staff
    assert client.get("/api/products", headers=headers_anon).status_code == 401
    assert client.get("/api/products", headers=headers_cust).status_code == 403
    assert client.get("/api/products", headers=headers_staff).status_code == 200
    assert client.get("/api/products", headers=headers_admin).status_code == 200
    # Writes: Admin only
    prod_payload = {"name": "Matrix Prod", "type": "software", "sales_price": 1000}
    assert client.post("/api/products", headers=headers_anon, json=prod_payload).status_code == 401
    assert client.post("/api/products", headers=headers_cust, json=prod_payload).status_code == 403
    assert client.post("/api/products", headers=headers_staff, json=prod_payload).status_code == 403
    res_admin_p = client.post("/api/products", headers=headers_admin, json=prod_payload)
    assert res_admin_p.status_code == 201
    p_id = res_admin_p.json()["id"]

    # 6. /api/plans
    # Reads: Admin & Staff
    assert client.get("/api/plans", headers=headers_anon).status_code == 401
    assert client.get("/api/plans", headers=headers_cust).status_code == 403
    assert client.get("/api/plans", headers=headers_staff).status_code == 200
    assert client.get("/api/plans", headers=headers_admin).status_code == 200
    # Writes: Admin only
    plan_payload = {"name": "Matrix Plan", "price": 5000, "billing_period": "monthly"}
    assert client.post("/api/plans", headers=headers_anon, json=plan_payload).status_code == 401
    assert client.post("/api/plans", headers=headers_cust, json=plan_payload).status_code == 403
    assert client.post("/api/plans", headers=headers_staff, json=plan_payload).status_code == 403
    res_admin_plan = client.post("/api/plans", headers=headers_admin, json=plan_payload)
    assert res_admin_plan.status_code == 201
    plan_id = res_admin_plan.json()["id"]

    # 7. /api/taxes
    # Reads: Admin & Staff
    assert client.get("/api/taxes", headers=headers_anon).status_code == 401
    assert client.get("/api/taxes", headers=headers_cust).status_code == 403
    assert client.get("/api/taxes", headers=headers_staff).status_code == 200
    assert client.get("/api/taxes", headers=headers_admin).status_code == 200
    # Writes: Admin only
    tax_payload = {"name": "Matrix Tax", "rate": 1800, "scope": "all"}
    assert client.post("/api/taxes", headers=headers_anon, json=tax_payload).status_code == 401
    assert client.post("/api/taxes", headers=headers_cust, json=tax_payload).status_code == 403
    assert client.post("/api/taxes", headers=headers_staff, json=tax_payload).status_code == 403
    assert client.post("/api/taxes", headers=headers_admin, json=tax_payload).status_code == 201

    # 8. /api/discounts
    # Reads: Admin & Staff
    assert client.get("/api/discounts", headers=headers_anon).status_code == 401
    assert client.get("/api/discounts", headers=headers_cust).status_code == 403
    assert client.get("/api/discounts", headers=headers_staff).status_code == 200
    assert client.get("/api/discounts", headers=headers_admin).status_code == 200
    # Writes: Admin only
    disc_payload = {
        "name": "Matrix Disc",
        "type": "fixed",
        "value": 100,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "applies_to": "subscription",
    }
    assert client.post("/api/discounts", headers=headers_anon, json=disc_payload).status_code == 401
    assert client.post("/api/discounts", headers=headers_cust, json=disc_payload).status_code == 403
    assert client.post("/api/discounts", headers=headers_staff, json=disc_payload).status_code == 403
    assert client.post("/api/discounts", headers=headers_admin, json=disc_payload).status_code == 201

    # 9. /api/quotation-templates (Admin and Staff can write and read)
    tmpl_payload = {"name": "Matrix Tmpl", "plan_id": plan_id, "validity_days": 30, "lines": []}
    assert client.get("/api/quotation-templates", headers=headers_anon).status_code == 401
    assert client.get("/api/quotation-templates", headers=headers_cust).status_code == 403
    assert client.get("/api/quotation-templates", headers=headers_staff).status_code == 200
    assert client.get("/api/quotation-templates", headers=headers_admin).status_code == 200
    # Staff CAN create quotation template
    assert client.post("/api/quotation-templates", headers=headers_staff, json=tmpl_payload).status_code == 201
