import datetime
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import hash_password
from app.models.catalog import DiscountRule, Plan, Product, ProductVariant, TaxRule
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.payment import Payment
from app.models.sequence import get_next_invoice_number, get_next_subscription_number
from app.models.subscription import Subscription, SubscriptionEvent, SubscriptionLine
from app.models.user import User

logger = logging.getLogger(__name__)


def ensure_default_accounts(db: Session) -> None:
    """Ensure the standard default accounts and sample data for Demo Traders exist.

    Idempotent: skips existing accounts without modifying their passwords.
    """
    created_items = []
    today = datetime.date.today()

    # 1. Admin Account
    admin_user = db.query(User).filter(User.email == "admin@brightloop.com").first()
    if not admin_user:
        admin_user = User(
            email="admin@brightloop.com",
            full_name="System Administrator",
            hashed_password=hash_password("Admin@1234"),
            role="admin",
            is_active=True,
        )
        db.add(admin_user)
        db.flush()
        created_items.append("admin account (admin@brightloop.com / Admin@1234)")
    elif admin_user.role != "admin":
        admin_user.role = "admin"
        db.flush()

    # 2. Staff Account
    staff_user = db.query(User).filter(User.email == "staff@brightloop.com").first()
    if not staff_user:
        staff_user = User(
            email="staff@brightloop.com",
            full_name="Operations Staff",
            hashed_password=hash_password("Staff@1234"),
            role="staff",
            is_active=True,
        )
        db.add(staff_user)
        db.flush()
        created_items.append("staff account (staff@brightloop.com / Staff@1234)")
    elif staff_user.role != "staff":
        staff_user.role = "staff"
        db.flush()

    # 3. Customer Account
    cust_user = db.query(User).filter(User.email == "customer@brightloop.com").first()
    if not cust_user:
        cust_user = User(
            email="customer@brightloop.com",
            full_name="Demo Customer",
            hashed_password=hash_password("Customer@1234"),
            role="customer",
            is_active=True,
        )
        db.add(cust_user)
        db.flush()
        created_items.append("customer account (customer@brightloop.com / Customer@1234)")

    # 4. Demo Customer Record ("Demo Traders")
    demo_cust = db.query(Customer).filter(Customer.email == "customer@brightloop.com").first()
    if not demo_cust:
        demo_cust = Customer(
            name="Demo Customer",
            company_name="Demo Traders",
            email="customer@brightloop.com",
            phone="+91 98765 43210",
            address_line1="42 Commercial Street",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560001",
            country="India",
            tax_id="GSTIN29DEMOT1234Z",
            user_id=cust_user.id,
            is_active=True,
        )
        db.add(demo_cust)
        db.flush()
        created_items.append("customer profile (Demo Traders)")
    elif not demo_cust.user_id:
        demo_cust.user_id = cust_user.id
        db.flush()

    # 5. Base Tax Rule
    tax_rule = db.query(TaxRule).filter(TaxRule.is_active == True).first()
    if not tax_rule:
        tax_rule = TaxRule(
            name="GST 18%",
            rate=1800,
            scope="all",
            is_active=True,
        )
        db.add(tax_rule)
        db.flush()
        created_items.append("tax rule (GST 18%)")

    # 6. Base Products & Variants
    prod_erp = db.query(Product).filter(Product.name == "Brightloop ERP Suite").first()
    if not prod_erp:
        prod_erp = Product(
            name="Brightloop ERP Suite",
            type="software",
            sales_price=100000,
            cost_price=50000,
            notes="Comprehensive enterprise management",
            is_active=True,
        )
        db.add(prod_erp)
        db.flush()
        created_items.append("product (Brightloop ERP Suite)")

    variant_odoo = db.query(ProductVariant).filter(
        ProductVariant.product_id == prod_erp.id,
        ProductVariant.attribute == "Brand",
        ProductVariant.value == "Odoo",
    ).first()
    if not variant_odoo:
        variant_odoo = ProductVariant(
            product_id=prod_erp.id,
            attribute="Brand",
            value="Odoo",
            extra_price=56000,  # +560 INR
        )
        db.add(variant_odoo)
        db.flush()
        created_items.append("variant (Brand = Odoo +560 INR)")

    prod_addon = db.query(Product).filter(Product.name == "Priority Support Add-on").first()
    if not prod_addon:
        prod_addon = Product(
            name="Priority Support Add-on",
            type="add_on",
            sales_price=25000,
            cost_price=10000,
            notes="24/7 dedicated engineering support",
            is_active=True,
        )
        db.add(prod_addon)
        db.flush()
        created_items.append("add-on (Priority Support Add-on)")

    # 7. Base Plans
    plan_monthly = db.query(Plan).filter(Plan.name == "Professional Monthly").first()
    if not plan_monthly:
        plan_monthly = Plan(
            name="Professional Monthly",
            billing_period="monthly",
            price=20000,
            min_quantity=1,
            auto_close=False,
            closable=True,
            pausable=True,
            renewable=True,
            available_from=today - datetime.timedelta(days=180),
            available_to=today + datetime.timedelta(days=365),
            is_active=True,
        )
        db.add(plan_monthly)
        db.flush()
        created_items.append("plan (Professional Monthly)")

    # 8. Check if Demo Traders has sample subscriptions in different statuses
    existing_subs = db.query(Subscription).filter(Subscription.customer_id == demo_cust.id).all()
    sub_statuses = {s.status for s in existing_subs}

    # Helper to create subscription
    def create_demo_sub(status_val, is_paused=False):
        num = get_next_subscription_number(db)
        start_d = today - datetime.timedelta(days=90)
        exp_d = today + datetime.timedelta(days=275)
        sub = Subscription(
            number=num,
            customer_id=demo_cust.id,
            plan_id=plan_monthly.id,
            start_date=start_d,
            expiry_date=exp_d,
            payment_terms="immediate",
            status=status_val,
            next_billing_date=today if status_val == "active" else start_d,
            is_paused=is_paused,
            created_by=admin_user.id,
            recurring_subtotal=176000,
        )
        db.add(sub)
        db.flush()
        # Add lines
        line1 = SubscriptionLine(
            subscription_id=sub.id,
            product_id=prod_erp.id,
            variant_id=variant_odoo.id,
            quantity=1,
            unit_price=156000,
            amount=156000,
            enabled=True,
        )
        line2 = SubscriptionLine(
            subscription_id=sub.id,
            product_id=prod_addon.id,
            quantity=1,
            unit_price=20000,
            amount=20000,
            enabled=True,
        )
        db.add_all([line1, line2])
        # Add event
        ev = SubscriptionEvent(
            subscription_id=sub.id,
            to_status=status_val,
            action="init",
            actor_id=admin_user.id,
            note="Initialized demo subscription",
        )
        db.add(ev)
        db.flush()
        return sub

    active_sub = None
    for s in existing_subs:
        if s.status == "active":
            active_sub = s

    for needed_status in ["draft", "quotation", "confirmed", "active", "closed"]:
        if needed_status not in sub_statuses:
            created_sub = create_demo_sub(needed_status)
            if needed_status == "active":
                active_sub = created_sub
            created_items.append(f"subscription ({needed_status}) for Demo Traders")

    # 9. Invoices for Demo Traders (draft, confirmed, paid, overdue)
    if active_sub:
        existing_invoices = db.query(Invoice).filter(Invoice.customer_id == demo_cust.id).all()
        has_draft_inv = any(i.status == "draft" for i in existing_invoices)
        has_confirmed_inv = any(i.status == "confirmed" and i.due_date >= today for i in existing_invoices)
        has_paid_inv = any(i.status == "paid" for i in existing_invoices)
        has_overdue_inv = any(i.status == "confirmed" and i.due_date < today and i.balance > 0 for i in existing_invoices)

        def create_demo_invoice(inv_status, inv_date, due_d, is_paid=False):
            num = get_next_invoice_number(db, inv_date.year)
            subtotal = 176000
            tax = 31680
            total = subtotal + tax
            amount_paid = total if is_paid else 0
            balance = 0 if is_paid else total

            inv = Invoice(
                number=num,
                subscription_id=active_sub.id,
                customer_id=demo_cust.id,
                customer_name=demo_cust.name,
                company_name=demo_cust.company_name,
                customer_email=demo_cust.email,
                billing_address_line1=demo_cust.address_line1,
                city=demo_cust.city,
                state=demo_cust.state,
                postal_code=demo_cust.postal_code,
                country=demo_cust.country,
                tax_id=demo_cust.tax_id,
                period_start=inv_date,
                period_end=inv_date + datetime.timedelta(days=30),
                invoice_date=inv_date,
                due_date=due_d,
                status=inv_status,
                subtotal=subtotal,
                discount_total=0,
                tax_total=tax,
                total=total,
                amount_paid=amount_paid,
                balance=balance,
            )
            db.add(inv)
            db.flush()

            # Line
            line = InvoiceLine(
                invoice_id=inv.id,
                product_id=prod_erp.id,
                description=f"{prod_erp.name} ({variant_odoo.attribute}: {variant_odoo.value})",
                quantity=1,
                unit_price=156000,
                discount_amount=0,
                tax_name=tax_rule.name,
                tax_rate=1800,
                tax_amount=28080,
                line_total=184080,
            )
            db.add(line)
            db.flush()

            if is_paid:
                pmt = Payment(
                    invoice_id=inv.id,
                    amount=total,
                    method="upi",
                    payment_date=inv_date,
                    note="Paid via UPI",
                    recorded_by=staff_user.id,
                )
                db.add(pmt)
                db.flush()

            return inv

        if not has_draft_inv:
            create_demo_invoice("draft", today, today + datetime.timedelta(days=15))
            created_items.append("draft invoice for Demo Traders")

        if not has_confirmed_inv:
            create_demo_invoice("confirmed", today - datetime.timedelta(days=30), today + datetime.timedelta(days=15))
            created_items.append("confirmed invoice for Demo Traders")

        if not has_paid_inv:
            create_demo_invoice("paid", today - datetime.timedelta(days=60), today - datetime.timedelta(days=45), is_paid=True)
            created_items.append("paid invoice with payment for Demo Traders")

        if not has_overdue_inv:
            create_demo_invoice("confirmed", today - datetime.timedelta(days=90), today - datetime.timedelta(days=60))
            created_items.append("overdue invoice for Demo Traders")

    db.commit()

    if created_items:
        logger.info("[Bootstrap] Created default accounts and sample data: %s", ", ".join(created_items))
    else:
        logger.info("[Bootstrap] Default accounts and sample data already verified and up to date.")
