import pytest
from fastapi.testclient import TestClient


def test_staff_management_by_admin(client: TestClient, auth_tokens):
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}

    # 1. Admin creates staff
    res = client.post(
        "/api/staff",
        headers=headers_admin,
        json={
            "full_name": "New Staff",
            "email": "new_staff@example.com",
            "password": "Staff@Password123",
        },
    )
    assert res.status_code == 201
    staff_id = res.json()["id"]

    # 2. Admin lists staff
    res_list = client.get("/api/staff", headers=headers_admin)
    assert res_list.status_code == 200
    assert any(s["email"] == "new_staff@example.com" for s in res_list.json()["items"])

    # 3. Admin updates staff
    res_up = client.put(
        f"/api/staff/{staff_id}",
        headers=headers_admin,
        json={"full_name": "Updated Staff Name"},
    )
    assert res_up.status_code == 200
    assert res_up.json()["full_name"] == "Updated Staff Name"

    # 4. Admin soft-deletes staff
    res_del = client.delete(f"/api/staff/{staff_id}", headers=headers_admin)
    assert res_del.status_code == 200
    assert res_del.json()["is_active"] is False


def test_staff_and_customer_forbidden_on_staff_routes(client: TestClient, auth_tokens):
    headers_staff = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    headers_cust = {"Authorization": f"Bearer {auth_tokens['cust1']}"}

    # Staff forbidden on /api/staff
    res1 = client.get("/api/staff", headers=headers_staff)
    assert res1.status_code == 403
    assert res1.json()["code"] == "FORBIDDEN_ROLE"

    res2 = client.post(
        "/api/staff",
        headers=headers_staff,
        json={"full_name": "Fails", "email": "fail@staff.com", "password": "Valid@Password1"},
    )
    assert res2.status_code == 403

    # Customer forbidden on /api/staff
    res3 = client.get("/api/staff", headers=headers_cust)
    assert res3.status_code == 403
