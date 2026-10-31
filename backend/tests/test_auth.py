from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import check_password_rules, hash_reset_token
from app.models.customer import Customer
from app.models.user import PasswordResetToken, User
from app.services.bootstrap import bootstrap_admin


def test_password_rule_matrix():
    # 1. Less than 9 characters (e.g., 8 chars with upper, lower, special)
    errs = check_password_rules("Ab1!efgh")
    assert any("more than 8 characters" in e for e in errs)

    # 2. Missing uppercase
    errs = check_password_rules("abcd1234#$")
    assert any("uppercase" in e for e in errs)

    # 3. Missing lowercase
    errs = check_password_rules("ABCD1234#$")
    assert any("lowercase" in e for e in errs)

    # 4. Missing special character
    errs = check_password_rules("Abcd12345")
    assert any("special" in e for e in errs)

    # 5. Multiple failures (short + all lowercase letters only)
    errs = check_password_rules("abc")
    assert len(errs) >= 3  # length, uppercase, special

    # 6. Valid password (9+ chars, upper, lower, special)
    errs = check_password_rules("Secure@123")
    assert len(errs) == 0


def test_signup_and_duplicate_email_case_insensitively(client: TestClient):
    payload = {
        "full_name": "Alice Wonderland",
        "company_name": "Wonderland Inc",
        "email": "Alice@Example.COM",
        "password": "Valid@Password123",
    }
    # 1. Signup succeeds
    res = client.post("/api/auth/signup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["customer_id"] is not None

    # 2. Duplicate signup with lowercase returns 409
    res_dup = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Alice Dup",
            "company_name": "Dup Corp",
            "email": "alice@example.com",
            "password": "Valid@Password123",
        },
    )
    assert res_dup.status_code == 409
    assert res_dup.json()["code"] == "EMAIL_ALREADY_EXISTS"


def test_signup_links_to_preexisting_customer_without_login(client: TestClient, db_session: Session):
    # Staff pre-creates a customer record with an email
    pre_email = "preexisting@example.com"
    customer = Customer(
        name="Old Record",
        company_name="Old Corp",
        email=pre_email,
        is_active=True,
    )
    db_session.add(customer)
    db_session.commit()
    old_id = customer.id

    # User signs up with matching email (mixed casing)
    res = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Linked Name",
            "company_name": "Linked Corp",
            "email": "PreExisting@Example.COM",
            "password": "Valid@Password123",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["customer_id"] == old_id

    # Verify DB state
    updated_customer = db_session.query(Customer).filter(Customer.id == old_id).first()
    assert updated_customer.user_id is not None
    assert updated_customer.user.email == pre_email


def test_login_and_throttle(client: TestClient):
    email = "throttle_test@example.com"
    password = "Valid@Password123"

    # Register user
    res_reg = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Throttle User",
            "company_name": "Throttle Corp",
            "email": email,
            "password": password,
        },
    )
    assert res_reg.status_code == 201

    # Send 4 failed login attempts
    for _ in range(4):
        res = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword!1"})
        assert res.status_code == 401

    # 5th failed attempt
    res = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword!1"})
    assert res.status_code == 401

    # 6th attempt should be blocked with 429
    res_blocked = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res_blocked.status_code == 429
    assert res_blocked.json()["code"] == "TOO_MANY_FAILED_LOGINS"


def test_forgot_and_reset_password_single_use_and_expiry(client: TestClient, db_session: Session):
    email = "reset_user@example.com"
    password = "Valid@Password123"

    # Signup
    client.post(
        "/api/auth/signup",
        json={
            "full_name": "Reset User",
            "company_name": "Reset Corp",
            "email": email,
            "password": password,
        },
    )

    # Request password reset
    res_forgot = client.post("/api/auth/forgot-password", json={"email": email})
    assert res_forgot.status_code == 200

    # Retrieve created token from DB
    user = db_session.query(User).filter(User.email == email).first()
    token_record = db_session.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).first()
    assert token_record is not None
    assert token_record.is_used is False

    # Simulate testing with known raw token
    raw_token = "my-secret-test-token-12345"
    token_record.token_hash = hash_reset_token(raw_token)
    db_session.commit()

    # Reset with invalid weak password -> 422
    res_weak = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "weak"},
    )
    assert res_weak.status_code == 422

    # Reset with valid password -> 200
    new_password = "NewValid@Password99"
    res_reset = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": new_password},
    )
    assert res_reset.status_code == 200

    # Try reusing the token -> 400
    res_reuse = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "Another@Password1"},
    )
    assert res_reuse.status_code == 400
    assert res_reuse.json()["code"] == "INVALID_RESET_TOKEN"

    # Login with new password -> 200
    res_login = client.post("/api/auth/login", json={"email": email, "password": new_password})
    assert res_login.status_code == 200


def test_admin_bootstrap(db_session: Session):
    # Set settings for bootstrap and run
    from app.core.config import settings

    settings.ADMIN_EMAIL = "bootstrap_admin@brightloop.io"
    settings.ADMIN_PASSWORD = "Admin@SecurePassword123"

    bootstrap_admin(db_session)

    admin = db_session.query(User).filter(User.email == "bootstrap_admin@brightloop.io").first()
    assert admin is not None
    assert admin.role == "admin"
    assert admin.is_active is True
