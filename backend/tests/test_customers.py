from fastapi.testclient import TestClient


def test_customer_management_by_staff_and_admin(client: TestClient, auth_tokens):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}

    # 1. Staff creates customer
    res = client.post(
        "/api/customers",
        headers=headers_staff,
        json={
            "name": "Acme Client",
            "company_name": "Acme Industries",
            "email": "contact@acme.com",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    )
    assert res.status_code == 201
    cust_id = res.json()["id"]

    # 2. Staff lists customers
    res_list = client.get("/api/customers?search=Acme", headers=headers_staff)
    assert res_list.status_code == 200
    assert res_list.json()["total"] >= 1
    assert any(c["id"] == cust_id for c in res_list.json()["items"])

    # 3. Admin updates customer
    res_up = client.put(
        f"/api/customers/{cust_id}",
        headers=headers_admin,
        json={"phone": "+91 9999999999", "tax_id": "GSTIN99ABCDE1234F1Z1"},
    )
    assert res_up.status_code == 200
    assert res_up.json()["phone"] == "+91 9999999999"

    # 4. Staff soft deletes customer
    res_del = client.delete(f"/api/customers/{cust_id}", headers=headers_staff)
    assert res_del.status_code == 200
    assert res_del.json()["is_active"] is False


def test_customer_forbidden_on_management_route(client: TestClient, auth_tokens):
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}

    # Customer tries to access /api/customers
    res = client.get("/api/customers", headers=headers_cust)
    assert res.status_code == 403


def test_customer_portal_and_isolation(client: TestClient, auth_tokens):
    headers_cust1 = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    headers_cust2 = {"Authorization": f"Bearer {auth_tokens['cust2']}"}
    c1_id = auth_tokens["c1_id"]
    c2_id = auth_tokens["c2_id"]

    # 1. Cust1 accesses /api/portal/me
    res_me = client.get("/api/portal/me", headers=headers_cust1)
    assert res_me.status_code == 200
    assert res_me.json()["id"] == c1_id

    # 2. Cust1 updates /api/portal/me
    res_update = client.put(
        "/api/portal/me",
        headers=headers_cust1,
        json={"city": "Mysore", "address_line1": "456 Palace Road"},
    )
    assert res_update.status_code == 200
    assert res_update.json()["city"] == "Mysore"

    # 3. Isolation: Cust1 accesses own record by ID -> 200
    res_own = client.get(f"/api/portal/customer/{c1_id}", headers=headers_cust1)
    assert res_own.status_code == 200
    assert res_own.json()["id"] == c1_id

    # 4. Isolation: Cust1 accesses Cust2's record by ID -> MUST RETURN 404 (NOT 403!)
    res_other = client.get(f"/api/portal/customer/{c2_id}", headers=headers_cust1)
    assert res_other.status_code == 404
    assert res_other.json()["code"] == "CUSTOMER_NOT_FOUND"
