import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import random
import sys
import time
from typing import Dict, List, Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import delete, func, text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.models.catalog import (
    DiscountRule,
    Plan,
    Product,
    ProductVariant,
    QuotationTemplate,
    QuotationTemplateLine,
    TaxRule,
)
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.payment import Payment
from app.models.sequence import SequenceCounter
from app.models.subscription import Subscription, SubscriptionLine
from app.models.user import User

# Constant Seed Credentials
ADMIN_EMAIL = "admin@brightloop.io"
ADMIN_PASSWORD = "Admin@Brightloop2026"
STAFF1_EMAIL = "staff1@brightloop.io"
STAFF1_PASSWORD = "Staff@Brightloop2026"
STAFF2_EMAIL = "staff2@brightloop.io"
STAFF2_PASSWORD = "Staff@Brightloop2026"
CUST_PASSWORD = "Cust@Brightloop2026"

INDIAN_CITIES = [
    ("Mumbai", "Maharashtra", "400001"),
    ("Bengaluru", "Karnataka", "560001"),
    ("Delhi", "Delhi", "110001"),
    ("Hyderabad", "Telangana", "500001"),
    ("Chennai", "Tamil Nadu", "600001"),
    ("Pune", "Maharashtra", "411001"),
    ("Kolkata", "West Bengal", "700001"),
    ("Ahmedabad", "Gujarat", "380001"),
    ("Jaipur", "Rajasthan", "302001"),
    ("Kochi", "Kerala", "682001"),
    ("Noida", "Uttar Pradesh", "201301"),
    ("Gurugram", "Haryana", "122001"),
    ("Indore", "Madhya Pradesh", "452001"),
    ("Chandigarh", "Punjab", "160001"),
    ("Coimbatore", "Tamil Nadu", "641001"),
]

INDIAN_COMPANIES = [
    "Tata Consultancy Services", "Infosys Technologies", "Wipro Digital Solutions", "HCL Enterprises",
    "Reliance Industries", "Larsen & Toubro", "Mahindra & Mahindra", "Adani Enterprises",
    "Bajaj Finserv", "Bharti Airtel Business", "Sun Pharmaceutical", "Dr Reddys Laboratories",
    "Cipla Healthcare", "Godrej Consumer Products", "ITC Infotech", "Maruti Suzuki Logistics",
    "Titan Company", "Asian Paints Commerce", "UltraTech Cement", "JSW Steel Infra",
    "HDFC Bank Enterprise", "ICICI Securities", "Kotak Mahindra Digital", "Axis Enterprise",
    "State Bank of India", "Zomato Logistics", "Swiggy Delivery", "Paytm Merchant Services",
    "Ola Mobility", "Nykaa E-Commerce", "PolicyBazaar Financial", "Freshworks India",
    "Postman API Labs", "Razorpay Software", "Zerodha Broking", "Groww Invest Tech",
    "Delhivery Supply Chain", "Shiprocket Logistics", "BigBasket Retail", "Urban Company",
    "CleverTap Analytics", "MoEngage Cloud", "Chargebee Billing", "Hasura GraphQL",
    "BrowserStack Labs", "Druva Cloud Data", "Icertis Contract", "Gupshup Messaging",
    "Pine Labs Commerce", "CRED Financial", "Pharmeasy Healthcare", "Licious Gourmet",
    "Zepto Quick Commerce", "Blinkit Retail", "Mamaearth Personal Care", "Lenskart Solutions",
    "Cars24 Auto Tech", "Spinny Motors", "Acko General Insurance", "Digit Insurance",
]

FIRST_NAMES = [
    "Aarav", "Aditi", "Aditya", "Akash", "Ananya", "Anil", "Ankit", "Anushka",
    "Arjun", "Deepak", "Dev", "Divya", "Gaurav", "Harsh", "Ishaan", "Kavita",
    "Kiran", "Manish", "Meera", "Neha", "Nikhil", "Nisha", "Pooja", "Pranav",
    "Priya", "Rahul", "Rajesh", "Rakesh", "Riya", "Rohan", "Rohit", "Sameer",
    "Sanjay", "Shreya", "Siddharth", "Sneha", "Sunil", "Suresh", "Tanvi", "Varun",
    "Vikram", "Vivek", "Amit", "Alok", "Kunal", "Mehul", "Preeti", "Sonal", "Swati", "Tarun"
]

LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Patel", "Reddy", "Nair", "Iyer", "Rao",
    "Mehta", "Jain", "Shah", "Singh", "Kumar", "Mishra", "Joshi", "Bose",
    "Chatterjee", "Banerjee", "Deshmukh", "Kulkarni", "Patil", "Choudhury",
    "Agarwal", "Bansal", "Goel", "Garg", "Kapoor", "Khanna", "Bhatia", "Malhotra"
]


def generate_gstin(state_code: str = "27") -> str:
    pan = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=5)) + "".join(random.choices("0123456789", k=4)) + random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return f"{state_code}{pan}1Z{random.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')}"


def clear_database(db: Session):
    """Clean slate wipe in correct foreign key order."""
    db.execute(delete(Payment))
    db.execute(delete(InvoiceLine))
    db.execute(delete(Invoice))
    db.execute(delete(SubscriptionLine))
    db.execute(delete(Subscription))
    db.execute(delete(QuotationTemplateLine))
    db.execute(delete(QuotationTemplate))
    db.execute(delete(ProductVariant))
    db.execute(delete(Product))
    db.execute(delete(Plan))
    db.execute(delete(TaxRule))
    db.execute(delete(DiscountRule))
    db.execute(delete(Customer))
    db.execute(delete(User))
    db.execute(delete(SequenceCounter))
    db.commit()


def run_seed(size: int = 5000, reset: bool = True, db: Optional[Session] = None):
    start_time = time.time()
    print(f"[*] Starting seed script with target size = {size} subscriptions (reset={reset})...")

    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    try:
        existing_subs = db.query(func.count(Subscription.id)).scalar()
        if existing_subs >= size and not reset:
            print(f"[!] Database already contains {existing_subs} subscriptions. Skipping seed. (Use --reset to force re-seed)")
            return

        if reset:
            print("[*] Resetting database tables...")
            clear_database(db)

        now_utc = datetime.now(timezone.utc)
        today = date.today()

        # ==========================================
        # 1. USERS & LOGINS
        # ==========================================
        print("[*] Creating staff and admin logins...")
        admin_pwd_hash = hash_password(ADMIN_PASSWORD)
        staff_pwd_hash = hash_password(STAFF1_PASSWORD)
        cust_pwd_hash = hash_password(CUST_PASSWORD)

        users_to_create = [
            {"id": 1, "email": ADMIN_EMAIL, "hashed_password": admin_pwd_hash, "full_name": "Brightloop Admin", "role": "admin", "is_active": True},
            {"id": 2, "email": STAFF1_EMAIL, "hashed_password": staff_pwd_hash, "full_name": "Arjun Sharma (Staff)", "role": "staff", "is_active": True},
            {"id": 3, "email": STAFF2_EMAIL, "hashed_password": staff_pwd_hash, "full_name": "Priya Patel (Staff)", "role": "staff", "is_active": True},
        ]
        # 10 customer users
        for i in range(1, 11):
            users_to_create.append({
                "id": 3 + i,
                "email": f"customer{i}@brightloop.io",
                "hashed_password": cust_pwd_hash,
                "full_name": f"Portal Customer {i}",
                "role": "customer",
                "is_active": True,
            })
        db.bulk_insert_mappings(User, users_to_create)
        db.commit()

        # ==========================================
        # 2. CUSTOMERS (~300)
        # ==========================================
        print("[*] Creating 300 Indian enterprise customers...")
        customers_to_create = []
        random.seed(42)  # Deterministic seed

        for i in range(1, 301):
            city, state, pin = random.choice(INDIAN_CITIES)
            comp_base = INDIAN_COMPANIES[(i - 1) % len(INDIAN_COMPANIES)]
            company = f"{comp_base} #{i}" if i > len(INDIAN_COMPANIES) else comp_base
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            linked_user_id = (3 + i) if i <= 10 else None
            email = f"customer{i}@brightloop.io" if i <= 10 else f"contact{i}@{comp_base.lower().replace(' ', '').replace('&', '')}.in"

            customers_to_create.append({
                "id": i,
                "name": name,
                "company_name": company,
                "email": email,
                "phone": f"+91{random.randint(7000000000, 9999999999)}",
                "address_line1": f"{random.randint(10, 999)}, Tech Park Road, Sector {random.randint(1, 62)}",
                "address_line2": f"Tower {random.choice(['A', 'B', 'C'])}, Floor {random.randint(1, 18)}",
                "city": city,
                "state": state,
                "postal_code": pin,
                "country": "India",
                "tax_id": generate_gstin("27" if state == "Maharashtra" else "29"),
                "is_active": True,
                "user_id": linked_user_id,
            })
        db.bulk_insert_mappings(Customer, customers_to_create)
        db.commit()

        # ==========================================
        # 3. CATALOG: PRODUCTS & VARIANTS (12 products)
        # ==========================================
        print("[*] Creating 12 products and Brand variants (Odoo +560 INR)...")
        products_data = [
            # 6 Software / Services
            {"id": 1, "name": "Cloud ERP Core", "type": "software", "sales_price": 50000, "is_active": True},
            {"id": 2, "name": "CRM Automation Suite", "type": "software", "sales_price": 35000, "is_active": True},
            {"id": 3, "name": "HRMS & Payroll Portal", "type": "software", "sales_price": 25000, "is_active": True},
            {"id": 4, "name": "Inventory Optimizer", "type": "software", "sales_price": 30000, "is_active": True},
            {"id": 5, "name": "Analytics Dashboard Pro", "type": "software", "sales_price": 40000, "is_active": True},
            {"id": 6, "name": "API Gateway Integration", "type": "service", "sales_price": 20000, "is_active": True},
            # 3 Add-ons
            {"id": 7, "name": "Priority 24/7 SLA Support", "type": "add_on", "sales_price": 15000, "is_active": True},
            {"id": 8, "name": "Extra 1TB Cloud Storage", "type": "add_on", "sales_price": 10000, "is_active": True},
            {"id": 9, "name": "Dedicated Account Manager", "type": "add_on", "sales_price": 25000, "is_active": True},
            # 3 Hardware products
            {"id": 10, "name": "POS Touch Terminal", "type": "hardware", "sales_price": 85000, "is_active": True},
            {"id": 11, "name": "Thermal Receipt Printer", "type": "hardware", "sales_price": 15000, "is_active": True},
            {"id": 12, "name": "Barcode Scanner Handheld", "type": "hardware", "sales_price": 12000, "is_active": True},
        ]
        db.bulk_insert_mappings(Product, products_data)
        db.commit()

        # Variants for POS Terminal: Brand = Odoo (+56000 paise = 560 INR)
        variants_data = [
            {"id": 1, "product_id": 10, "attribute": "Brand", "value": "Standard", "extra_price": 0, "is_active": True},
            {"id": 2, "product_id": 10, "attribute": "Brand", "value": "Odoo", "extra_price": 56000, "is_active": True},
            {"id": 3, "product_id": 11, "attribute": "Interface", "value": "USB", "extra_price": 0, "is_active": True},
            {"id": 4, "product_id": 11, "attribute": "Interface", "value": "Ethernet/Wi-Fi", "extra_price": 3000, "is_active": True},
        ]
        db.bulk_insert_mappings(ProductVariant, variants_data)
        db.commit()

        # ==========================================
        # 4. PLANS (8 plans)
        # ==========================================
        print("[*] Creating 8 subscription plans across billing periods and flags...")
        plans_data = [
            {"id": 1, "name": "Starter Daily", "price": 4900, "billing_period": "daily", "min_quantity": 1, "auto_close": True, "closable": True, "pausable": True, "renewable": True, "is_active": True},
            {"id": 2, "name": "Flex Weekly", "price": 24900, "billing_period": "weekly", "min_quantity": 1, "auto_close": False, "closable": True, "pausable": True, "renewable": True, "is_active": True},
            {"id": 3, "name": "Growth Monthly", "price": 99900, "billing_period": "monthly", "min_quantity": 1, "auto_close": False, "closable": True, "pausable": True, "renewable": True, "is_active": True},
            {"id": 4, "name": "Enterprise Monthly", "price": 299900, "billing_period": "monthly", "min_quantity": 1, "auto_close": True, "closable": True, "pausable": True, "renewable": True, "is_active": True},
            {"id": 5, "name": "Standard Yearly", "price": 999900, "billing_period": "yearly", "min_quantity": 1, "auto_close": False, "closable": True, "pausable": True, "renewable": True, "is_active": True},
            {"id": 6, "name": "Corporate Yearly", "price": 2499900, "billing_period": "yearly", "min_quantity": 1, "auto_close": True, "closable": False, "pausable": False, "renewable": True, "is_active": True},
            {"id": 7, "name": "Legacy Fixed Monthly", "price": 79900, "billing_period": "monthly", "min_quantity": 1, "auto_close": True, "closable": True, "pausable": False, "renewable": False, "is_active": True},
            {"id": 8, "name": "Locked Term Monthly", "price": 149900, "billing_period": "monthly", "min_quantity": 1, "auto_close": False, "closable": False, "pausable": True, "renewable": True, "is_active": True},
        ]
        db.bulk_insert_mappings(Plan, plans_data)
        db.commit()

        # ==========================================
        # 5. TAX RULES & DISCOUNTS
        # ==========================================
        print("[*] Creating GST tax rules and 5 discount rules...")
        tax_rules_data = [
            {"id": 1, "name": "GST 18%", "rate": 1800, "scope": "all", "scope_value": None, "is_active": True},
            {"id": 2, "name": "Addon GST 12%", "rate": 1200, "scope": "product_type", "scope_value": "add_on", "is_active": True},
            {"id": 3, "name": "Hardware Special GST 5%", "rate": 500, "scope": "product", "scope_value": "10", "is_active": True},
        ]
        db.bulk_insert_mappings(TaxRule, tax_rules_data)

        discounts_data = [
            {"id": 1, "name": "Early Bird 10%", "type": "percent", "value": 1000, "start_date": today - timedelta(days=90), "end_date": today + timedelta(days=90), "usage_limit": 1000, "used_count": 42, "applies_to": "subscription", "is_active": True},
            {"id": 2, "name": "Fixed Launch 500", "type": "fixed", "value": 50000, "start_date": today - timedelta(days=60), "end_date": today + timedelta(days=60), "usage_limit": 500, "used_count": 28, "applies_to": "subscription", "is_active": True},
            {"id": 3, "name": "Expired Festive Offer", "type": "percent", "value": 1500, "start_date": today - timedelta(days=120), "end_date": today - timedelta(days=10), "usage_limit": 100, "used_count": 65, "applies_to": "subscription", "is_active": True},
            {"id": 4, "name": "Exhausted Promo", "type": "fixed", "value": 25000, "start_date": today - timedelta(days=60), "end_date": today + timedelta(days=60), "usage_limit": 50, "used_count": 50, "applies_to": "subscription", "is_active": True},
            {"id": 5, "name": "Future New Year Promo", "type": "percent", "value": 2000, "start_date": today + timedelta(days=30), "end_date": today + timedelta(days=90), "usage_limit": 200, "used_count": 0, "applies_to": "subscription", "is_active": True},
        ]
        db.bulk_insert_mappings(DiscountRule, discounts_data)

        templates_data = [
            {"id": 1, "name": "Growth SaaS Bundle", "plan_id": 3, "validity_days": 30, "is_active": True},
            {"id": 2, "name": "Enterprise Complete Pack", "plan_id": 4, "validity_days": 45, "is_active": True},
            {"id": 3, "name": "Retail POS Standard", "plan_id": 1, "validity_days": 15, "is_active": True},
        ]
        db.bulk_insert_mappings(QuotationTemplate, templates_data)

        tmpl_lines_data = [
            {"id": 1, "template_id": 1, "product_id": 2, "variant_id": None, "quantity": 1},
            {"id": 2, "template_id": 1, "product_id": 7, "variant_id": None, "quantity": 1},
            {"id": 3, "template_id": 2, "product_id": 1, "variant_id": None, "quantity": 1},
            {"id": 4, "template_id": 2, "product_id": 8, "variant_id": None, "quantity": 2},
            {"id": 5, "template_id": 3, "product_id": 10, "variant_id": 2, "quantity": 1},
        ]
        db.bulk_insert_mappings(QuotationTemplateLine, tmpl_lines_data)
        db.commit()

        # ==========================================
        # 6. SUBSCRIPTIONS (Target: size, default 5000)
        # ==========================================
        print(f"[*] Generating {size} subscriptions with realistic status distribution...")
        subs_data = []
        sub_lines_data = []
        sub_line_id = 1

        # Status distribution:
        # ~150 Active subscriptions due for billing today (next_billing_date = today)
        # Remaining Active: ~3600
        # Paused: ~250
        # Closed: ~500
        # Confirmed: ~250
        # Quotation: ~150
        # Draft: ~100
        due_active_count = 150
        num_active = int(size * 0.75)
        num_closed = int(size * 0.10)
        num_confirmed = int(size * 0.05)
        num_paused = int(size * 0.05)
        num_quotation = int(size * 0.03)
        num_draft = size - (num_active + num_closed + num_confirmed + num_paused + num_quotation)

        status_pool = (
            [("active", False)] * num_active
            + [("closed", False)] * num_closed
            + [("confirmed", False)] * num_confirmed
            + [("active", True)] * num_paused
            + [("quotation", False)] * num_quotation
            + [("draft", False)] * num_draft
        )
        random.shuffle(status_pool)

        # Plan price lookup
        plan_prices = {p["id"]: p["price"] for p in plans_data}

        # Ensure the first 150 active subs are due today
        active_due_assigned = 0

        for s_idx in range(1, size + 1):
            sub_num = f"BL-{s_idx:05d}"
            cust_id = ((s_idx - 1) % 300) + 1
            plan_id = ((s_idx - 1) % 8) + 1
            plan_price = plan_prices[plan_id]

            status, is_paused = status_pool[s_idx - 1]

            # Start and Expiry
            if status in ("active", "closed", "confirmed"):
                months_ago = random.randint(1, 12)
                start_d = today - relativedelta(months=months_ago)
                expiry_d = start_d + relativedelta(months=12)
            else:
                start_d = today + timedelta(days=random.randint(0, 15))
                expiry_d = start_d + relativedelta(months=12)

            # Next billing date
            if status == "active" and not is_paused and active_due_assigned < due_active_count:
                next_bill_d = today
                active_due_assigned += 1
            elif status == "active":
                next_bill_d = today + timedelta(days=random.randint(1, 28))
            else:
                next_bill_d = start_d

            # Products on subscription
            # 1 software product + 1 optional add-on
            prod1_id = ((s_idx - 1) % 6) + 1
            prod1_price = products_data[prod1_id - 1]["sales_price"]

            addon_id = 7 + ((s_idx - 1) % 3)
            addon_price = products_data[addon_id - 1]["sales_price"]
            has_addon = (s_idx % 2 == 0)

            recurring_subtotal = plan_price + prod1_price + (addon_price if has_addon else 0)

            subs_data.append({
                "id": s_idx,
                "number": sub_num,
                "customer_id": cust_id,
                "plan_id": plan_id,
                "start_date": start_d,
                "expiry_date": expiry_d,
                "payment_terms": random.choice(["immediate", "net_15", "net_30"]),
                "status": status,
                "next_billing_date": next_bill_d,
                "is_paused": is_paused,
                "quotation_valid_until": today + timedelta(days=30) if status == "quotation" else None,
                "template_id": None,
                "notes": f"Standard subscription contract {sub_num}",
                "created_by": 1,
                "recurring_subtotal": recurring_subtotal,
            })

            # Subscription lines
            sub_lines_data.append({
                "id": sub_line_id,
                "subscription_id": s_idx,
                "product_id": prod1_id,
                "variant_id": None,
                "quantity": 1,
                "unit_price": prod1_price,
                "amount": prod1_price,
                "enabled": True,
            })
            sub_line_id += 1

            if has_addon:
                sub_lines_data.append({
                    "id": sub_line_id,
                    "subscription_id": s_idx,
                    "product_id": addon_id,
                    "variant_id": None,
                    "quantity": 1,
                    "unit_price": addon_price,
                    "amount": addon_price,
                    "enabled": True,
                })
                sub_line_id += 1

        print(f"[*] Bulk inserting {len(subs_data)} subscriptions and {len(sub_lines_data)} subscription lines...")
        db.bulk_insert_mappings(Subscription, subs_data)
        db.bulk_insert_mappings(SubscriptionLine, sub_lines_data)
        db.commit()

        # ==========================================
        # 7. HISTORICAL INVOICES & PAYMENTS (~30,000)
        # ==========================================
        print("[*] Generating ~30,000 historical invoices over the last 12 months with matching payments...")
        invoices_data = []
        inv_lines_data = []
        payments_data = []

        inv_id_seq = 1
        inv_line_id_seq = 1
        payment_id_seq = 1

        cust_map = {c["id"]: c for c in customers_to_create}
        sub_map = {s["id"]: s for s in subs_data}

        # For historical invoices, iterate over eligible subscriptions
        # and create multiple periods (up to 12 monthly periods each) until target ~30,000
        eligible_subs = [s for s in subs_data if s["status"] in ("active", "closed", "confirmed")]
        target_invoices = 30000
        periods_per_sub = 12

        for sub in eligible_subs:
            s_id = sub["id"]
            c_id = sub["customer_id"]
            cust = cust_map[c_id]
            s_start = sub["start_date"]

            for m in range(periods_per_sub):
                p_start = s_start + relativedelta(months=m)
                if p_start > today:
                    break

                p_end = p_start + relativedelta(months=1) - timedelta(days=1)
                inv_num = f"INV-{p_start.year}-{inv_id_seq:05d}"
                due_d = p_start + timedelta(days=15)

                subtotal = sub["recurring_subtotal"]
                tax_amt = int((Decimal(subtotal) * Decimal("0.18")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
                total = subtotal + tax_amt

                # Realistic status mix:
                # 80% paid, 10% partially paid, 5% outstanding, 3% overdue, 2% cancelled
                rnd = random.random()
                if rnd < 0.80:
                    inv_status = "paid"
                    amount_paid = total
                    balance = 0
                elif rnd < 0.90:
                    inv_status = "confirmed"
                    amount_paid = int(total * 0.5)
                    balance = total - amount_paid
                elif rnd < 0.95:
                    inv_status = "confirmed"
                    amount_paid = 0
                    balance = total
                    if due_d < today:
                        due_d = today + timedelta(days=7)  # not overdue
                elif rnd < 0.98:
                    inv_status = "confirmed"
                    amount_paid = 0
                    balance = total
                    due_d = today - timedelta(days=random.randint(1, 30))  # overdue
                else:
                    inv_status = "cancelled"
                    amount_paid = 0
                    balance = total

                invoices_data.append({
                    "id": inv_id_seq,
                    "number": inv_num,
                    "subscription_id": s_id,
                    "customer_id": c_id,
                    "customer_name": cust["name"],
                    "company_name": cust["company_name"],
                    "customer_email": cust["email"],
                    "billing_address_line1": cust["address_line1"],
                    "billing_address_line2": cust["address_line2"],
                    "city": cust["city"],
                    "state": cust["state"],
                    "postal_code": cust["postal_code"],
                    "country": cust["country"],
                    "tax_id": cust["tax_id"],
                    "period_start": p_start,
                    "period_end": p_end,
                    "invoice_date": p_start,
                    "due_date": due_d,
                    "status": inv_status,
                    "subtotal": subtotal,
                    "discount_total": 0,
                    "tax_total": tax_amt,
                    "total": total,
                    "amount_paid": amount_paid,
                    "balance": balance,
                    "applied_discount_id": None,
                    "discount_name": None,
                    "sent_at": datetime.combine(p_start, datetime.min.time(), tzinfo=timezone.utc),
                    "created_at": datetime.combine(p_start, datetime.min.time(), tzinfo=timezone.utc),
                    "updated_at": datetime.combine(p_start, datetime.min.time(), tzinfo=timezone.utc),
                })

                # Invoice line: 1 base plan fee line
                plan_price = plan_prices[sub["plan_id"]]
                inv_lines_data.append({
                    "id": inv_line_id_seq,
                    "invoice_id": inv_id_seq,
                    "product_id": None,
                    "description": f"Subscription Plan Charge",
                    "quantity": 1,
                    "unit_price": plan_price,
                    "discount_amount": 0,
                    "tax_name": "GST 18%",
                    "tax_rate": 1800,
                    "tax_amount": int((Decimal(plan_price) * Decimal("0.18")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
                    "line_total": plan_price + int((Decimal(plan_price) * Decimal("0.18")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
                })
                inv_line_id_seq += 1

                # If paid or partially paid, create payment record(s)
                if amount_paid > 0:
                    pay_method = random.choice(["upi", "card", "bank_transfer", "cash"])
                    pay_date = min(today, p_start + timedelta(days=random.randint(1, 10)))
                    payments_data.append({
                        "id": payment_id_seq,
                        "invoice_id": inv_id_seq,
                        "method": pay_method,
                        "amount": amount_paid,
                        "payment_date": pay_date,
                        "note": f"Automatic payment clearance for {inv_num}",
                        "recorded_by": 1,
                        "created_at": datetime.combine(pay_date, datetime.min.time(), tzinfo=timezone.utc),
                    })
                    payment_id_seq += 1

                inv_id_seq += 1
                if len(invoices_data) >= target_invoices:
                    break

            if len(invoices_data) >= target_invoices:
                break

        print(f"[*] Bulk inserting {len(invoices_data)} invoices, {len(inv_lines_data)} invoice lines, and {len(payments_data)} payments in batches...")
        # Batch insert to prevent SQLite variable limits
        batch_size = 5000
        for i in range(0, len(invoices_data), batch_size):
            db.bulk_insert_mappings(Invoice, invoices_data[i:i + batch_size])
        db.commit()

        for i in range(0, len(inv_lines_data), batch_size):
            db.bulk_insert_mappings(InvoiceLine, inv_lines_data[i:i + batch_size])
        db.commit()

        for i in range(0, len(payments_data), batch_size):
            db.bulk_insert_mappings(Payment, payments_data[i:i + batch_size])
        db.commit()

        # Update atomic sequence counters
        db.execute(text("INSERT OR REPLACE INTO sequence_counters (name, current_value) VALUES ('subscription', :val)"), {"val": size})
        db.execute(text(f"INSERT OR REPLACE INTO sequence_counters (name, current_value) VALUES ('invoice_{today.year}', :val)"), {"val": inv_id_seq})
        db.commit()

        elapsed = time.time() - start_time
        print(f"[+] Successfully seeded database in {elapsed:.2f} seconds!")
        print(f"    - Subscriptions: {len(subs_data)}")
        print(f"    - Invoices: {len(invoices_data)}")
        print(f"    - Payments: {len(payments_data)}")
        print(f"    - Active Due Subscriptions: {active_due_assigned}")

    except Exception as exc:
        db.rollback()
        print(f"[!] Error seeding database: {exc}", file=sys.stderr)
        raise
    finally:
        if own_session:
            db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed Brightloop Subscription Management System database")
    parser.add_argument("size_pos", nargs="?", type=int, default=None, help="Number of subscriptions to seed (default 5000)")
    parser.add_argument("--size", type=int, default=5000, help="Number of subscriptions to seed (default 5000)")
    parser.add_argument("--no-reset", action="store_true", help="Do not wipe existing data before seeding")
    args = parser.parse_args()

    target_size = args.size_pos if args.size_pos is not None else args.size
    reset_db = not args.no_reset

    run_seed(size=target_size, reset=reset_db)


if __name__ == "__main__":
    main()
