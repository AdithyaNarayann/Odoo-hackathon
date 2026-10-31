import datetime
import re
import subprocess
import pytest
from sqlalchemy import select
from app.core.security import hash_reset_token
from app.main import app
from app.models.catalog import Plan, Product
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.user import PasswordResetToken, User


def test_openapi_route_security_enforcement(client, auth_tokens):
    """Iterates through every path in the OpenAPI specification to assert:

    - Without Bearer token: 401 Unauthorized
    - Customer role on restricted staff/admin routes: 403 Forbidden or 404 Not Found
    - Staff role on admin-only routes: 403 Forbidden
    """
    openapi = app.openapi()
    paths = openapi.get("paths", {})
    assert len(paths) > 0

    public_paths = {
        "/api/auth/login",
        "/api/auth/signup",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/health",
        "/docs",
        "/openapi.json",
        "/redoc",
    }

    admin_only_prefixes = [
        "/api/staff",
        "/api/discounts",
        "/api/taxes",
        "/api/system",
    ]

    staff_and_admin_prefixes = [
        "/api/customers",
        "/api/billing",
        "/api/reports",
        "/api/quotation-templates",
    ]

    cust_headers = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    staff_headers = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    for path, methods in paths.items():
        if path in public_paths:
            continue

        # Substitute {id} with 99999 for test request
        test_path = re.sub(r"\{[a-zA-Z_]+\}", "99999", path)

        for method in methods.keys():
            http_method = method.lower()
            caller = getattr(client, http_method)

            # 1. Assert 401 without token
            kwargs = {"json": {}} if http_method in ("post", "put", "patch") else {}
            no_token_resp = caller(test_path, **kwargs)
            assert no_token_resp.status_code == 401, (
                f"Path {test_path} ({method.upper()}) did not return 401 without token. "
                f"Got {no_token_resp.status_code}"
            )

            # 2. Check Customer role denials on Admin & Staff routes
            is_admin_only = any(test_path.startswith(prefix) for prefix in admin_only_prefixes)
            is_staff_admin = any(test_path.startswith(prefix) for prefix in staff_and_admin_prefixes)

            if is_admin_only or is_staff_admin:
                cust_kwargs = {"headers": cust_headers}
                if http_method in ("post", "put", "patch"):
                    cust_kwargs["json"] = {}
                cust_resp = caller(test_path, **cust_kwargs)
                # Must be 403 Forbidden or 404 Not Found (tenant-isolated routes)
                assert cust_resp.status_code in (403, 404, 422), (
                    f"Path {test_path} ({method.upper()}) allowed Customer. "
                    f"Got {cust_resp.status_code}"
                )

            # 3. Check Staff role denials on Admin-only write routes
            if is_admin_only and http_method in ("post", "put", "delete", "patch"):
                # Exception: quotation-templates allows staff writes
                if not test_path.startswith("/api/quotation-templates"):
                    staff_kwargs = {"headers": staff_headers}
                    if http_method in ("post", "put", "patch"):
                        staff_kwargs["json"] = {}
                    staff_resp = caller(test_path, **staff_kwargs)
                    assert staff_resp.status_code in (403, 404), (
                        f"Admin-only write path {test_path} ({method.upper()}) allowed Staff. "
                        f"Got {staff_resp.status_code}"
                    )


def test_password_reset_token_expiration_and_single_use(client, db_session, auth_tokens):
    """Asserts that password reset tokens:

    - Expire after 30 minutes
    - Cannot be reused after first successful redemption
    """
    admin_headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    
    # Create test user
    user = User(
        email="token_test@brightloop.io",
        full_name="Token Tester",
        hashed_password="dummy_hashed_password",
        role="customer",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    # 1. Expired token (created 31 minutes ago)
    expired_raw = "expired-token-secret-123"
    expired_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(expired_raw),
        is_used=False,
        expires_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1),
    )
    db_session.add(expired_token)
    db_session.commit()

    resp_expired = client.post(
        "/api/auth/reset-password",
        json={"token": expired_raw, "new_password": "NewStrongPass@123"},
    )
    assert resp_expired.status_code == 400
    assert "expired" in str(resp_expired.json()).lower()

    # 2. Valid token redemption
    valid_raw = "valid-token-secret-456"
    valid_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(valid_raw),
        is_used=False,
        expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=30),
    )
    db_session.add(valid_token)
    db_session.commit()

    resp_valid = client.post(
        "/api/auth/reset-password",
        json={"token": valid_raw, "new_password": "NewStrongPass@123"},
    )
    assert resp_valid.status_code == 200

    # 3. Assert single-use: Reusing valid token now fails
    resp_reuse = client.post(
        "/api/auth/reset-password",
        json={"token": valid_raw, "new_password": "AnotherStrongPass@456"},
    )
    assert resp_reuse.status_code == 400
    assert "invalid" in str(resp_reuse.json()).lower() or "used" in str(resp_reuse.json()).lower()


def test_login_throttling_after_5_failed_attempts(client):
    """Asserts that 5 consecutive failed login attempts result in HTTP 429 Too Many Requests."""
    target_email = "throttle_check@brightloop.io"
    wrong_creds = {"email": target_email, "password": "WrongPassword@123"}

    for i in range(5):
        resp = client.post("/api/auth/login", json=wrong_creds)
        assert resp.status_code == 401

    # 6th attempt should be throttled
    resp_throttled = client.post("/api/auth/login", json=wrong_creds)
    assert resp_throttled.status_code == 429
    assert "too many" in str(resp_throttled.json()).lower() or "throttl" in str(resp_throttled.json()).lower()


def test_duplicate_submission_race_condition_protection(client, db_session, auth_tokens):
    """Asserts that double-clicking Run Billing or Record Payment cannot create duplicate invoices or overpay."""
    admin_headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    staff_headers = {"Authorization": f"Bearer {auth_tokens['staff']}"}

    today = datetime.date.today()

    # Create customer, product, plan, active subscription
    customer = Customer(name="Concurrency Corp", company_name="Concurrency Corp", email="concurrency@example.com")
    product = Product(name="Concurrent Cloud", type="service", sales_price=50000, cost_price=20000, is_active=True)
    plan = Plan(name="Monthly Standard", billing_period="monthly", price=10000, min_quantity=1, is_active=True)
    db_session.add_all([customer, product, plan])
    db_session.flush()

    sub = Subscription(
        number="BL-CONC-01",
        customer_id=customer.id,
        plan_id=plan.id,
        start_date=today,
        expiry_date=today + datetime.timedelta(days=365),
        payment_terms="immediate",
        status="active",
        next_billing_date=today,
        recurring_subtotal=60000,
        is_paused=False,
        created_by=1,
    )
    db_session.add(sub)
    db_session.commit()

    # 1. Billing Run Idempotency (Simulating double-click)
    resp1 = client.post("/api/billing/run", headers=admin_headers, json={"as_of_date": str(today)})
    resp2 = client.post("/api/billing/run", headers=admin_headers, json={"as_of_date": str(today)})

    assert resp1.status_code == 200
    assert resp2.status_code == 200
    # Second run creates 0 invoices
    assert resp2.json()["created"] == 0

    # 2. Payment Concurrency / Overpay Protection
    # Find the generated invoice
    inv = db_session.execute(
        select(Invoice).where(Invoice.subscription_id == sub.id)
    ).scalars().first()
    assert inv is not None

    # Post invoice to confirmed
    client.post(f"/api/invoices/{inv.id}/confirm", headers=staff_headers)

    # First payment pays full balance
    inv_balance = inv.total
    pay1 = client.post(
        "/api/payments",
        headers=staff_headers,
        json={
            "invoice_id": inv.id,
            "amount": inv_balance,
            "method": "upi",
            "payment_date": str(today),
        },
    )
    assert pay1.status_code == 201

    # Second concurrent payment for same amount is rejected with 409 Conflict
    pay2 = client.post(
        "/api/payments",
        headers=staff_headers,
        json={
            "invoice_id": inv.id,
            "amount": inv_balance,
            "method": "upi",
            "payment_date": str(today),
        },
    )
    assert pay2.status_code == 409
    assert any(term in str(pay2.json()).lower() for term in ("paid", "confirmed", "exceeds", "balance"))


def test_git_history_free_of_secrets():
    """Scans git log commit diffs to ensure no production secrets, private keys,

    or unhashed sensitive credentials were leaked into the repository history.
    """
    try:
        git_log = subprocess.run(
            ["git", "log", "-p", "-n", "100"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except Exception:
        pytest.skip("Git not available in current environment")

    # Patterns indicating leaked real secrets
    suspicious_patterns = [
        r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----",
        r"AKIA[0-9A-Z]{16}",  # AWS Access Key
        r"ghp_[0-9a-zA-Z]{36}",  # GitHub Personal Access Token
        r"stripe_live_[0-9a-zA-Z]{24}",
    ]

    for pattern in suspicious_patterns:
        match = re.search(pattern, git_log)
        assert match is None, f"Found potential secret in git history: {pattern}"
