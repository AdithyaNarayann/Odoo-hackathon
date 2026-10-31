"""
End-to-end verification script for Brightloop Subscription Management System.
"""
import sys
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def verify():
    print("Testing /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("Health check OK:", res.json())

    # Test company config without auth
    res = client.get("/api/config/company")
    assert res.status_code == 401, f"Expected 401 for unauthenticated company config, got {res.status_code}"
    print("Security check passed: unauthenticated access rejected with 401")

    # Test signup
    print("Testing signup...")
    signup_payload = {
        "full_name": "E2E Admin",
        "company_name": "E2E Systems",
        "email": "e2e_user@example.com",
        "password": "E2ePassword@123",
    }
    res = client.post("/api/auth/signup", json=signup_payload)
    if res.status_code == 201:
        token = res.json()["access_token"]
        print("Signup successful. Token received.")
    elif res.status_code == 409:
        # Already exists, login
        login_res = client.post("/api/auth/login", json={"email": "e2e_user@example.com", "password": "E2ePassword@123"})
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        print("Login successful. Token received.")
    else:
        raise AssertionError(f"Signup/login unexpected status: {res.status_code} {res.text}")

    # Authenticated company config
    res = client.get("/api/config/company", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("Company config retrieved:", res.json()["company_name"])

    print("\nALL VERIFICATION CHECKS PASSED.")


if __name__ == "__main__":
    verify()
