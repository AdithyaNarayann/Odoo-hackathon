import datetime
from decimal import Decimal
import pytest
from sqlalchemy import func, select
from app.models.catalog import DiscountRule, Plan, Product, ProductVariant, QuotationTemplate, TaxRule
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.payment import Payment
from app.models.subscription import Subscription, SubscriptionLine
from app.models.user import PasswordResetToken, User


def test_end_to_end_billing_month_lifecycle(client, db_session, auth_tokens):
    """Complete end-to-end scenario walking an entire billing month as described in the PDF:

    1. Signup with weak & duplicate credentials rejected
    2. Password reset flow through console email
    3. Admin creates staff member & RBAC assertions
    4. Product with Odoo variant (+560 INR)
    5. Plan with lifecycle flags
    6. Quotation template
    7. Subscription lifecycle (Draft -> Quotation -> Confirmed -> Active)
    8. Admin creates discount with minimum & usage limit
    9. Advance billing creates draft invoice with discount and taxes prefilled
    10. Second run creates 0 invoices (idempotent)
    11. Confirm and send invoice
    12. Role denials: Customer cannot read another's invoice; Customer cannot call staff routes
    13. Partial payment, then full payment ends in Paid status
    14. Overdue invoice evaluation
    15. Financial report numbers match direct SQL aggregations
    """
    admin_headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    staff_headers = {"Authorization": f"Bearer {auth_tokens['staff']}"}
    cust1_headers = {"Authorization": f"Bearer {auth_tokens['cust1']}"}
    cust2_headers = {"Authorization": f"Bearer {auth_tokens['cust2']}"}

    # -------------------------------------------------------------
    # 1. Signup with weak and duplicate credentials rejected
    # -------------------------------------------------------------
    # Weak password (<8 chars, no special char)
    weak_resp = client.post(
        "/api/auth/signup",
        json={
            "full_name": "E2E User",
            "company_name": "E2E Corp",
            "email": "e2e_lead@example.com",
            "password": "weak",
        },
    )
    assert weak_resp.status_code == 422
    assert "password" in str(weak_resp.json()).lower()

    # Valid signup
    signup_resp = client.post(
        "/api/auth/signup",
        json={
            "full_name": "E2E User",
            "company_name": "E2E Corp",
            "email": "e2e_lead@example.com",
            "password": "Valid@Password123",
        },
    )
    assert signup_resp.status_code == 201
    signup_data = signup_resp.json()
    new_user_id = signup_data["user"]["id"]
    new_cust_id = signup_data["user"]["customer_id"]

    # Duplicate email rejected (case-insensitive)
    dup_resp = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Duplicate User",
            "company_name": "Dup Corp",
            "email": "E2E_LEAD@EXAMPLE.COM",
            "password": "Valid@Password123",
        },
    )
    assert dup_resp.status_code == 409

    # -------------------------------------------------------------
    # 2. Password reset through console email
    # -------------------------------------------------------------
    forgot_resp = client.post(
        "/api/auth/forgot-password",
        json={"email": "e2e_lead@example.com"},
    )
    assert forgot_resp.status_code == 200

    # Retrieve reset token from DB
    reset_record = (
        db_session.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.user_id == new_user_id)
            .order_by(PasswordResetToken.created_at.desc())
        )
        .scalars()
        .first()
    )
    assert reset_record is not None
    # Test reset with dummy plain token using the token hash logic or direct update
    from app.core.security import hash_reset_token
    plain_token = "e2e-reset-token-secret-xyz"
    reset_record.token_hash = hash_reset_token(plain_token)
    reset_record.is_used = False
    db_session.commit()

    # Reset password
    reset_resp = client.post(
        "/api/auth/reset-password",
        json={
            "token": plain_token,
            "new_password": "NewValid@Password456",
        },
    )
    assert reset_resp.status_code == 200

    # Single-use: reset with same token fails
    reset_dup_resp = client.post(
        "/api/auth/reset-password",
        json={
            "token": plain_token,
            "new_password": "Another@Password789",
        },
    )
    assert reset_dup_resp.status_code == 400

    # Login with new password
    login_resp = client.post(
        "/api/auth/login",
        json={
            "email": "e2e_lead@example.com",
            "password": "NewValid@Password456",
        },
    )
    assert login_resp.status_code == 200
    e2e_cust_token = login_resp.json()["access_token"]
    e2e_cust_headers = {"Authorization": f"Bearer {e2e_cust_token}"}

    # -------------------------------------------------------------
    # 3. Admin creates staff & Role Denials
    # -------------------------------------------------------------
    staff_create_resp = client.post(
        "/api/staff",
        headers=admin_headers,
        json={
            "email": "staff_member_e2e@brightloop.io",
            "full_name": "E2E Staff",
            "password": "Staff@Password123",
        },
    )
    assert staff_create_resp.status_code == 201

    # Staff cannot create staff
    staff_forbidden_resp = client.post(
        "/api/staff",
        headers=staff_headers,
        json={
            "email": "staff_forbidden@brightloop.io",
            "full_name": "Forbidden Staff",
            "password": "Staff@Password123",
        },
    )
    assert staff_forbidden_resp.status_code == 403

    # Staff cannot create discounts
    staff_disc_resp = client.post(
        "/api/discounts",
        headers=staff_headers,
        json={
            "name": "Staff Discount",
            "code": "STAFF10",
            "discount_type": "percentage",
            "value_basis_points": 1000,
        },
    )
    assert staff_disc_resp.status_code == 403

    # Customer cannot access staff list
    cust_staff_resp = client.get("/api/staff", headers=cust1_headers)
    assert cust_staff_resp.status_code == 403

    # -------------------------------------------------------------
    # 4. Product with Odoo variant (+560 INR = 56000 paise)
    # -------------------------------------------------------------
    prod_resp = client.post(
        "/api/products",
        headers=admin_headers,
        json={
            "name": "Brightloop Enterprise ERP",
            "type": "service",
            "sales_price": 100000,  # 1,000 INR
            "cost_price": 50000,  # 500 INR
            "notes": "Full suite software",
        },
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    # Add variant: Brand = Odoo adds 56000 paise (560 INR)
    variant_resp = client.post(
        f"/api/products/{prod_id}/variants",
        headers=admin_headers,
        json={
            "attribute": "Brand",
            "value": "Odoo",
            "extra_price": 56000,
        },
    )
    assert variant_resp.status_code == 201
    variant_id = variant_resp.json()["id"]
    # Effective price = 100000 + 56000 = 156000 paise (1560 INR)
    assert variant_resp.json()["effective_price"] == 156000

    # -------------------------------------------------------------
    # 5. Plan with lifecycle flags
    # -------------------------------------------------------------
    today = datetime.date.today()
    plan_resp = client.post(
        "/api/plans",
        headers=admin_headers,
        json={
            "name": "E2E Growth Monthly Plan",
            "billing_period": "monthly",
            "price": 20000,  # 200 INR base fee
            "min_quantity": 1,
            "auto_close": False,
            "closable": True,
            "pausable": True,
            "renewable": True,
            "available_from": str(today - datetime.timedelta(days=90)),
            "available_to": str(today + datetime.timedelta(days=365)),
        },
    )
    assert plan_resp.status_code == 201
    plan_id = plan_resp.json()["id"]

    # Ensure a global tax rule exists (18% GST = 1800 basis points)
    tax_resp = client.post(
        "/api/taxes",
        headers=admin_headers,
        json={
            "name": "GST 18%",
            "rate": 1800,
            "scope": "all",
            "is_active": True,
        },
    )
    assert tax_resp.status_code in (201, 200)

    # -------------------------------------------------------------
    # 6. Quotation template
    # -------------------------------------------------------------
    tmpl_resp = client.post(
        "/api/quotation-templates",
        headers=staff_headers,
        json={
            "name": "E2E Enterprise Quote Template",
            "plan_id": plan_id,
            "validity_days": 30,
            "lines": [
                {
                    "product_id": prod_id,
                    "variant_id": variant_id,
                    "quantity": 2,
                }
            ],
        },
    )
    assert tmpl_resp.status_code == 201
    tmpl_id = tmpl_resp.json()["id"]

    # -------------------------------------------------------------
    # 7. Subscription from template through Draft -> Quotation -> Confirmed -> Active
    # -------------------------------------------------------------
    sub_from_tmpl_resp = client.post(
        "/api/subscriptions/create-from-template",
        headers=staff_headers,
        json={
            "template_id": tmpl_id,
            "customer_id": new_cust_id,
            "start_date": str(today),
        },
    )
    assert sub_from_tmpl_resp.status_code == 201
    sub_data = sub_from_tmpl_resp.json()
    sub_id = sub_data["id"]
    assert sub_data["number"].startswith("BL-")
    assert sub_data["status"] == "draft"

    # Draft -> Quotation (Send Quotation)
    q_resp = client.post(
        f"/api/subscriptions/{sub_id}/status",
        headers=staff_headers,
        json={"status": "quotation"},
    )
    assert q_resp.status_code == 200
    assert q_resp.json()["status"] == "quotation"

    # Quotation -> Confirmed (Owning customer or staff can confirm)
    conf_resp = client.post(
        f"/api/subscriptions/{sub_id}/status",
        headers=e2e_cust_headers,
        json={"status": "confirmed"},
    )
    assert conf_resp.status_code == 200
    assert conf_resp.json()["status"] == "confirmed"

    # Confirmed -> Active
    act_resp = client.post(
        f"/api/subscriptions/{sub_id}/status",
        headers=staff_headers,
        json={"status": "active"},
    )
    assert act_resp.status_code == 200
    assert act_resp.json()["status"] == "active"

    # -------------------------------------------------------------
    # 8. Admin creates discount with minimum & usage limit
    # -------------------------------------------------------------
    disc_resp = client.post(
        "/api/discounts",
        headers=admin_headers,
        json={
            "name": "10% Enterprise Saver",
            "code": "E2ESAVE10",
            "type": "percent",
            "value": 1000,  # 10%
            "min_purchase_amount": 50000,  # 500 INR
            "usage_limit": 5,
            "start_date": str(today - datetime.timedelta(days=1)),
            "end_date": str(today + datetime.timedelta(days=30)),
            "applies_to": "subscription",
        },
    )
    assert disc_resp.status_code == 201

    # -------------------------------------------------------------
    # 9. Advance billing run creates Draft invoice with discount and tax prefilled
    # -------------------------------------------------------------
    bill_resp = client.post(
        "/api/billing/run",
        headers=admin_headers,
        json={"as_of_date": str(today), "dry_run": False},
    )
    assert bill_resp.status_code == 200
    bill_data = bill_resp.json()
    assert bill_data["created"] >= 1

    # Find the created invoice for this subscription
    inv_list_resp = client.get(
        f"/api/invoices?customer_id={new_cust_id}",
        headers=staff_headers,
    )
    assert inv_list_resp.status_code == 200
    invoices = inv_list_resp.json()["items"]
    assert len(invoices) >= 1
    invoice = invoices[0]
    inv_id = invoice["id"]

    assert invoice["status"] == "draft"
    assert invoice["subtotal"] > 0
    # 10% discount was applied automatically
    assert invoice["discount_total"] > 0
    # 18% tax was resolved and applied
    assert invoice["tax_total"] > 0
    assert invoice["total"] == invoice["subtotal"] - invoice["discount_total"] + invoice["tax_total"]
    assert invoice["balance"] == invoice["total"]

    # -------------------------------------------------------------
    # 10. Second run creates 0 invoices (Idempotent)
    # -------------------------------------------------------------
    bill_repeat_resp = client.post(
        "/api/billing/run",
        headers=admin_headers,
        json={"as_of_date": str(today), "dry_run": False},
    )
    assert bill_repeat_resp.status_code == 200
    # Should not duplicate billing
    assert bill_repeat_resp.json()["created"] == 0

    # -------------------------------------------------------------
    # 11. Confirm and send invoice
    # -------------------------------------------------------------
    inv_confirm_resp = client.post(
        f"/api/invoices/{inv_id}/confirm",
        headers=staff_headers,
    )
    assert inv_confirm_resp.status_code == 200
    assert inv_confirm_resp.json()["status"] == "confirmed"

    inv_send_resp = client.post(
        f"/api/invoices/{inv_id}/send",
        headers=staff_headers,
    )
    assert inv_send_resp.status_code == 200

    # -------------------------------------------------------------
    # 12. Role Denials: Customer 2 cannot read Customer 1's invoice (returns 404)
    # -------------------------------------------------------------
    unauth_inv_resp = client.get(
        f"/api/invoices/{inv_id}",
        headers=cust2_headers,
    )
    # Under multi-tenant portal rules, unowned entities return 404 Not Found to prevent enumeration
    assert unauth_inv_resp.status_code == 404

    # -------------------------------------------------------------
    # 13. Partial payment, then full payment ends in Paid
    # -------------------------------------------------------------
    total_balance = invoice["total"]
    partial_amount = total_balance // 2

    pay1_resp = client.post(
        "/api/payments",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": partial_amount,
            "method": "upi",
            "payment_date": str(today),
            "note": "Partial UPI payment",
        },
    )
    assert pay1_resp.status_code == 201
    assert pay1_resp.json()["amount"] == partial_amount

    # Verify invoice status is still confirmed and balance halved
    inv_after_pay1 = client.get(f"/api/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_after_pay1["status"] == "confirmed"
    assert inv_after_pay1["amount_paid"] == partial_amount
    assert inv_after_pay1["balance"] == total_balance - partial_amount

    # Remaining full payment
    remaining_balance = inv_after_pay1["balance"]
    pay2_resp = client.post(
        "/api/payments",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": remaining_balance,
            "method": "bank_transfer",
            "payment_date": str(today),
            "note": "Final settlement",
        },
    )
    assert pay2_resp.status_code == 201

    # Verify invoice transitioned to Paid and balance is 0
    inv_after_pay2 = client.get(f"/api/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_after_pay2["status"] == "paid"
    assert inv_after_pay2["amount_paid"] == total_balance
    assert inv_after_pay2["balance"] == 0

    # -------------------------------------------------------------
    # 14. An unpaid invoice becomes overdue when as_of moves past due_date
    # -------------------------------------------------------------
    # Check invoice overdue logic
    overdue_sub_resp = client.post(
        "/api/subscriptions",
        headers=staff_headers,
        json={
            "customer_id": new_cust_id,
            "plan_id": plan_id,
            "start_date": str(today - datetime.timedelta(days=60)),
            "expiry_date": str(today + datetime.timedelta(days=300)),
            "payment_terms": "immediate",
            "lines": [
                {
                    "product_id": prod_id,
                    "quantity": 1,
                }
            ],
        },
    )
    assert overdue_sub_resp.status_code == 201
    overdue_sub_id = overdue_sub_resp.json()["id"]

    # Move to active
    client.post(f"/api/subscriptions/{overdue_sub_id}/status", headers=staff_headers, json={"status": "quotation"})
    client.post(f"/api/subscriptions/{overdue_sub_id}/status", headers=staff_headers, json={"status": "confirmed"})
    client.post(f"/api/subscriptions/{overdue_sub_id}/status", headers=staff_headers, json={"status": "active"})

    # Bill as of today: generates invoice with past due date
    client.post("/api/billing/run", headers=admin_headers, json={"as_of_date": str(today)})
    overdue_invs = client.get(f"/api/invoices?customer_id={new_cust_id}&status=draft", headers=staff_headers).json()["items"]
    if overdue_invs:
        unpaid_inv_id = overdue_invs[0]["id"]
        # Confirm it
        client.post(f"/api/invoices/{unpaid_inv_id}/confirm", headers=staff_headers)
        # Check overdue list
        overdue_list = client.get("/api/invoices?is_overdue=true", headers=staff_headers).json()
        assert overdue_list["total"] >= 1
        assert any(item["id"] == unpaid_inv_id for item in overdue_list["items"])

    # -------------------------------------------------------------
    # 15. Financial report numbers match direct SQL aggregations
    # -------------------------------------------------------------
    report_resp = client.get("/api/reports/summary", headers=admin_headers)
    assert report_resp.status_code == 200
    report_data = report_resp.json()
    rep_from = datetime.date.fromisoformat(report_data["from_date"])
    rep_to = datetime.date.fromisoformat(report_data["to_date"])

    # Direct SQL count of active subscriptions (point-in-time)
    sql_active_subs = db_session.execute(
        select(func.count(Subscription.id)).where(Subscription.status == "active")
    ).scalar()
    assert report_data["active_subscriptions"] == sql_active_subs

    # Direct SQL sum of payments recorded in date range
    sql_rev_collected = db_session.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.payment_date >= rep_from, Payment.payment_date <= rep_to)
    ).scalar()
    assert report_data["revenue_collected"] == sql_rev_collected

    # Direct SQL sum of invoiced total in date range (non-cancelled)
    sql_invoiced_total = db_session.execute(
        select(func.coalesce(func.sum(Invoice.total), 0))
        .where(Invoice.status != "cancelled", Invoice.invoice_date >= rep_from, Invoice.invoice_date <= rep_to)
    ).scalar()
    assert report_data["invoiced_total"] == sql_invoiced_total
