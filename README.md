# Brightloop Subscription Management System

Brightloop is an enterprise-grade subscription management and recurring billing platform engineered as the digital backbone of a modern software business. It manages the entire lifecycle of subscription contracts—from product catalog and multi-tier pricing to automated advance billing, atomic payment reconciliation, and real-time revenue analytics.

Built strictly in accordance with the neo-brutalist retro design system, featuring bold ink borders, crisp hard shadows, Anton typography, Archivo uppercase headings, Inter body, and tabular numbers for financial accuracy.

---

## Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (React 18 + Vite)"]
        UI["Neo-Brutalist UI & Design System"]
        Portal["Customer Self-Service Portal"]
        AdminUI["Admin & Staff Management Suite"]
        Router["React Router 6 + Route-Level Code Splitting"]
        Query["TanStack Query 5 (Caching & Sync)"]
    end

    subgraph API["Application Tier (FastAPI + Python 3.12)"]
        Auth["Auth & RBAC (JWT + Passlib/Bcrypt)"]
        Pricing["Pure Pricing & Discount Pipeline"]
        StateMachine["Subscription State Machine"]
        BillingEngine["Advance Billing & Catch-up Engine"]
        PaymentEngine["Atomic Payment Reconciliation"]
        Reports["Real-time SQL Analytics Engine"]
    end

    subgraph Background["Scheduler & Services Tier"]
        Scheduler["APScheduler (Daily In-Process Cron)"]
        EmailService["Asynchronous Email Service (SMTP/Console)"]
    end

    subgraph Storage["Persistence Tier (SQLAlchemy 2.0)"]
        DB[(Database: SQLite WAL / PostgreSQL)]
        Indexes["Composite & Single-Column B-Tree Indexes"]
    end

    Client -->|REST API over HTTP/JSON| API
    API -->|Async Tasks| Background
    API -->|SQLAlchemy ORM + Native SQL Aggregates| Storage
    Scheduler -->|Trigger Billing & Auto-close| API
```

---

## Key Features

1. **Product & Catalog Management**:
   - Products (Software, Add-ons, Services) with base sales price and cost price in integer paise.
   - Dynamic variant pricing (e.g., Brand = Odoo adds 560 INR / 56,000 paise).
   - Subscription plans across daily, weekly, monthly, and yearly cycles with lifecycle flags (`auto_close`, `closable`, `pausable`, `renewable`).
   - Quotation templates pre-populating plans, product variants, and quantities with validity periods.

2. **Full Lifecycle Subscription Contracts**:
   - Atomic sequential contract numbering (`BL-00001`).
   - Strict 5-state lifecycle: `Draft` &rarr; `Quotation` &rarr; `Confirmed` &rarr; `Active` &rarr; `Closed`.
   - Contract locking: header and line parameters lock after quotation; add-on lines can be dynamically attached or toggled on/off while Active without proration.
   - Self-service customer portal allowing customers to confirm quotes, toggle add-ons, or pause/resume/close contracts according to plan permissions.

3. **Pure Pricing Pipeline & Advance Billing Engine**:
   - Evaluates best-saving discount rules with threshold and product scope validation. Zero discount stacking.
   - Proportionally allocates discounts and resolves effective hierarchical tax rules (`product` > `product_type` > `all`).
   - Line totals match invoice totals to the exact integer paise with zero floating-point drift.
   - Guaranteed billing idempotency via `UNIQUE(subscription_id, period_start)` constraint. Prevents duplicate charges and catches up to 60 missed billing cycles automatically.

4. **Atomic Payment Reconciliation**:
   - Single-statement conditional atomic `UPDATE` on invoice balance before inserting payment records.
   - Eliminates race conditions and prevents concurrent overpayment without table-level locking.
   - Transitions invoices to `Paid` automatically when balance reaches 0.

5. **Financial Analytics & Global Search**:
   - Point-in-time and date-range metrics: active subscriptions count, normalized Monthly Recurring Revenue (MRR), total invoiced, revenue collected, and overdue receivables.
   - Recharts stacked revenue visualization splitting subscription base charges from add-on services.
   - Global multi-tenant search (`Ctrl+K`) with 300ms debounce and strict tenant scoping.

---

## Quick Start

### Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** & **npm 9+**
- Git

---

### Windows (PowerShell)

```powershell
# 1. Clone repository
git clone https://github.com/AdithyaNarayann/Odoo-hackathon.git
cd Odoo-hackathon

# 2. Install root and frontend dependencies
npm install
npm --prefix frontend install

# 3. Create virtual environment & install backend dependencies
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# 4. Copy environment configuration
Copy-Item .env.example .env

# 5. Run database migrations & seed 5,000 subscriptions
alembic upgrade head
$env:PYTHONPATH="backend"
python -m app.seed 5000

# 6. Start full-stack development server (Backend on :8000, Frontend on :3000)
npm run dev
```

---

### Linux / macOS (Bash)

```bash
# 1. Clone repository
git clone https://github.com/AdithyaNarayann/Odoo-hackathon.git
cd Odoo-hackathon

# 2. Install root and frontend dependencies
npm install
npm --prefix frontend install

# 3. Create virtual environment & install backend dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# 4. Copy environment configuration
cp .env.example .env

# 5. Run database migrations & seed 5,000 subscriptions
alembic upgrade head
PYTHONPATH=backend python -m app.seed 5000

# 6. Start full-stack development server (Backend on :8000, Frontend on :3000)
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## Default Dev Credentials (From Seeder)

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Admin** | `admin@brightloop.io` | `Admin@Brightloop2026` | Full system control, catalog, taxes, staff admin, billing |
| **Staff** | `sarah.ops@brightloop.io` | `Staff@Brightloop2026` | Customers, subscriptions, templates, invoices, payments |
| **Customer** | `rajesh@acmetech.in` | `Customer@Brightloop2026` | Customer self-service portal (own subscriptions & invoices) |

*(Quick demo buttons are available on the login page for instant one-click authentication)*

---

## Environment Variables

All settings are managed via `pydantic-settings` from `.env`. A complete template is provided in `.env.example`:

```ini
APP_NAME="Brightloop Subscription Management System"
APP_ENV=development
APP_TIMEZONE=Asia/Kolkata
SECRET_KEY=change-this-in-production-to-a-secure-random-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
RESET_TOKEN_EXPIRE_MINUTES=30

# Database Configuration
# Local SQLite (default):
DATABASE_URL=sqlite:///./brightloop.db
# PostgreSQL (production):
# DATABASE_URL=postgresql://user:password@localhost:5432/brightloop

FRONTEND_URL=http://localhost:3000

# Company Details for Invoices & Settings
COMPANY_NAME=Brightloop Technologies Pvt Ltd
COMPANY_ADDRESS=123 Innovation Way, Tech Park, Bangalore, KA, India
COMPANY_TAX_ID=GSTIN29ABCDE1234F1Z5
COMPANY_EMAIL=billing@brightloop.io
COMPANY_PHONE=+91 80 1234 5678

# Email Service
EMAIL_BACKEND=console # Use 'smtp' in production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user@domain.com
SMTP_PASSWORD=your-smtp-app-password
SMTP_FROM=noreply@brightloop.io
SMTP_TLS=true

# Admin Bootstrap
ADMIN_EMAIL=admin@brightloop.io
ADMIN_PASSWORD=Admin@123456

# Daily In-Process Scheduler (runs at SCHEDULER_HOUR:SCHEDULER_MINUTE Asia/Kolkata)
SCHEDULER_ENABLED=false
SCHEDULER_HOUR=0
SCHEDULER_MINUTE=0
```

---

## Running Automated Tests

```bash
# Run complete test suite (57 passing tests covering auth, RBAC, pricing, billing, concurrency, E2E)
pytest backend/tests -v

# Run dedicated End-to-End Billing Month scenario
pytest backend/tests/test_e2e_billing_month.py -v

# Run Automated Route Security & OpenAPI enforcement checks
pytest backend/tests/test_route_security.py -v

# Run Performance Latency & Advance Billing benchmarks
pytest backend/tests/test_performance.py -v -s

# Verify frontend production build & code-splitting
npm run build:frontend
```

---

## Key Decisions (from DECISIONS.md)

- **DEC-001 (Case-Insensitive Uniqueness)**: Email uniqueness is enforced case-insensitively using lowercase normalization at schema & model level to prevent duplicate accounts via casing variations.
- **DEC-002 (Portable SQL Types)**: Standard SQLAlchemy dialect types used without database-specific syntax; full compatibility between SQLite WAL and PostgreSQL.
- **DEC-005 (Integer Paise Currency)**: All monetary values stored and calculated in integer paise (1 INR = 100 paise) with half-up rounding (`ROUND_HALF_UP`) applied once per line. Floats are prohibited.
- **DEC-006 (Strict Multi-Tenant Isolation)**: Customer portal queries return 404 Not Found (not 403 Forbidden) for unowned records to prevent ID enumeration.
- **DEC-013 (Month-End Calendar Arithmetic)**: Advance billing calculation evaluates cycles relative to the contract's original `start_date` to prevent month-end day truncation drift (e.g. Jan 31 &rarr; Feb 28 &rarr; Mar 31).
- **DEC-016 (Atomic Concurrency Control)**: Payments use a single-statement conditional update (`UPDATE invoices SET amount_paid = ... WHERE balance >= amount`) to prevent concurrent overpayments under high contention.
- **DEC-017 (SQL Aggregates for Reporting)**: Reports compute metrics entirely in SQL aggregates with zero N+1 database queries.

---

## Deployment & Production Notes

1. **Scheduler Instance Constraint**:
   - The in-process APScheduler executes daily maintenance (activating confirmed subscriptions, auto-closing expired contracts, and running advance billing).
   - In horizontally scaled multi-container environments, **enable `SCHEDULER_ENABLED=true` on exactly ONE dedicated worker instance** to avoid duplicate billing job execution, or use an external task runner (e.g. Celery / AWS CloudWatch).

2. **Email Delivery**:
   - Set `EMAIL_BACKEND=smtp` in production with valid SMTP credentials to enable delivery of real password reset emails, invoice PDFs, and overdue reminders.

3. **PostgreSQL Migration**:
   - Set `DATABASE_URL=postgresql://user:password@host:5432/brightloop`.
   - Run `alembic upgrade head` to apply all migrations seamlessly.

---

## Known Limitations

1. **Multi-Currency Support**:
   - The system is purpose-built for Indian Rupees (INR) represented in integer paise. Multi-currency conversions (e.g. USD, EUR) are not supported in v1.0.0.
2. **Payment Gateway Integration**:
   - The payment engine models real-world reconciliation (cash, card, UPI, bank transfer, cheque) with atomic database concurrency control. Live third-party webhooks (e.g. Stripe, Razorpay) are not included out-of-the-box.
3. **Proration Policy**:
   - As specified, mid-cycle add-on toggling and additions apply from the next scheduled invoice cycle without mid-month proration.
