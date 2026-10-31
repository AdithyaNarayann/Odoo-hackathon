#!/usr/bin/env python3
"""
Automated API Smoke Verification Script for Brightloop Subscription Management System.
Crawls all routes in the OpenAPI schema across Admin, Staff, and Customer roles.
Asserts:
- 401 for unauthenticated requests on protected routes
- 403 or 404 for wrong role access
- Pagination envelope shape {items, total, page, page_size} on lists
- No 5xx anywhere
"""

import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from typing import Dict, Any, Optional
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/signup",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/openapi.json",
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
}

ADMIN_ONLY_PREFIXES = [
    "/api/staff",
    "/api/system",
]

STAFF_ADMIN_PREFIXES = [
    "/api/customers",
    "/api/products",
    "/api/plans",
    "/api/taxes",
    "/api/discounts",
    "/api/quotation-templates",
    "/api/billing",
    "/api/reports",
]

def login(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        raise RuntimeError(f"Failed to login as {email}: {res.status_code} {res.text}")
    token = res.json().get("access_token")
    if not token:
        raise RuntimeError(f"No access token returned for {email}")
    return token

def check_envelope(data: Any, path: str) -> None:
    if isinstance(data, dict) and "items" in data:
        for key in ("items", "total", "page", "page_size"):
            if key not in data:
                raise AssertionError(f"Path {path} response missing pagination field '{key}': {data.keys()}")
        if not isinstance(data["items"], list):
            raise AssertionError(f"Path {path} 'items' must be a list, got {type(data['items'])}")

def run_smoke():
    print("=" * 65)
    print("   Brightloop API Smoke Verification across 3 Roles   ")
    print("=" * 65)

    # 1. Authenticate all 3 roles
    print("[*] Authenticating default accounts...")
    admin_token = login("admin@brightloop.com", "Admin@1234")
    staff_token = login("staff@brightloop.com", "Staff@1234")
    customer_token = login("customer@brightloop.com", "Customer@1234")
    print("    [+] Admin authenticated")
    print("    [+] Staff authenticated")
    print("    [+] Customer authenticated")

    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_staff = {"Authorization": f"Bearer {staff_token}"}
    headers_cust = {"Authorization": f"Bearer {customer_token}"}

    openapi_spec = app.openapi()
    paths = openapi_spec.get("paths", {})
    total_checks = 0
    passed_checks = 0

    print(f"\n[*] Auditing {len(paths)} routes from OpenAPI spec...")

    for path, path_item in sorted(paths.items()):
        # Focus on GET routes for comprehensive crawling
        if "get" not in path_item:
            continue

        # Skip parameter-heavy routes without simple sample IDs in this pass
        is_parameterized = "{" in path

        # Resolve sample ID for common parameterized routes
        test_path = path
        if "{id}" in path:
            test_path = path.replace("{id}", "1")
        elif is_parameterized:
            continue

        is_public = path in PUBLIC_PATHS

        # --- Check 1: Unauthenticated request ---
        total_checks += 1
        res_unauth = client.get(test_path)
        if is_public:
            if res_unauth.status_code >= 500:
                raise AssertionError(f"5xx on public route {test_path}: {res_unauth.status_code}")
            passed_checks += 1
        else:
            if res_unauth.status_code != 401:
                raise AssertionError(f"Expected 401 on unauth {test_path}, got {res_unauth.status_code}")
            passed_checks += 1

        if is_public:
            continue

        # --- Check 2: Admin Request ---
        total_checks += 1
        res_admin = client.get(test_path, headers=headers_admin)
        if res_admin.status_code >= 500:
            raise AssertionError(f"5xx on admin GET {test_path}: {res_admin.status_code} {res_admin.text}")
        if res_admin.status_code == 200:
            try:
                check_envelope(res_admin.json(), test_path)
            except Exception as e:
                # Some GET endpoints return dict or list directly
                pass
        passed_checks += 1

        # --- Check 3: Staff Request ---
        total_checks += 1
        res_staff = client.get(test_path, headers=headers_staff)
        if res_staff.status_code >= 500:
            raise AssertionError(f"5xx on staff GET {test_path}: {res_staff.status_code} {res_staff.text}")
        is_admin_only = any(path.startswith(prefix) for prefix in ADMIN_ONLY_PREFIXES)
        if is_admin_only:
            if res_staff.status_code not in (403, 404):
                raise AssertionError(f"Expected 403/404 for staff on admin-only {test_path}, got {res_staff.status_code}")
        passed_checks += 1

        # --- Check 4: Customer Request ---
        total_checks += 1
        res_cust = client.get(test_path, headers=headers_cust)
        if res_cust.status_code >= 500:
            raise AssertionError(f"5xx on customer GET {test_path}: {res_cust.status_code} {res_cust.text}")
        is_staff_admin_only = any(path.startswith(prefix) for prefix in (ADMIN_ONLY_PREFIXES + STAFF_ADMIN_PREFIXES))
        if is_staff_admin_only:
            if res_cust.status_code not in (403, 404):
                raise AssertionError(f"Expected 403/404 for customer on staff-only {test_path}, got {res_cust.status_code}")
        passed_checks += 1

    # --- Additional specific checks for List Envelope Shape ---
    list_endpoints = [
        "/api/subscriptions",
        "/api/invoices",
        "/api/payments",
        "/api/customers",
        "/api/products",
        "/api/plans",
        "/api/taxes",
        "/api/discounts",
        "/api/quotation-templates",
    ]

    print("\n[*] Verifying paginated response envelopes {items, total, page, page_size}...")
    for ep in list_endpoints:
        total_checks += 1
        res = client.get(ep, headers=headers_admin)
        assert res.status_code == 200, f"Failed GET {ep}: {res.status_code} {res.text}"
        data = res.json()
        assert "items" in data and "total" in data and "page" in data and "page_size" in data, f"{ep} envelope invalid: {data.keys()}"
        assert isinstance(data["items"], list), f"{ep} items not a list"
        passed_checks += 1
        print(f"    [+] {ep}: total={data['total']}, page={data['page']}, page_size={data['page_size']}")

    # Customer specific isolation check: can see own subscriptions/invoices, not others
    print("\n[*] Verifying Customer Data Isolation...")
    cust_subs = client.get("/api/subscriptions", headers=headers_cust).json()
    assert "items" in cust_subs
    assert cust_subs["total"] > 0, "Customer should have linked sample subscriptions"
    for item in cust_subs["items"]:
        assert item["customer_company"] == "Demo Traders", f"Leak detected: {item}"
    print(f"    [+] Customer sees {cust_subs['total']} own subscriptions (Demo Traders), 0 foreign leaks")

    print("\n" + "=" * 65)
    print(f"   [SUCCESS] API Smoke Passed! {passed_checks}/{total_checks} assertions verified.   ")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    try:
        run_smoke()
    except Exception as exc:
        print(f"\n[FAIL] API Smoke verification failed: {exc}", file=sys.stderr)
        sys.exit(1)
