# Project State

## What is Done
- Repository initialized with `.gitignore` and `docs/AGENT_RULES.md`
- Working rules and conventions documented
- Decisions logged in `docs/DECISIONS.md` (DEC-001 through DEC-015)
- API specification documented in `docs/API.md`

### Milestone 1: Core Scaffolding & Database
- Application structure: `backend/app` (core, models, schemas, routers, services), `backend/tests`, `frontend`, `scripts`, `docs`
- Configuration with `pydantic-settings` (`backend/app/core/config.py`) and committed `.env.example`
- SQLAlchemy 2.0 database engine with SQLite WAL mode & 5000ms busy_timeout (`backend/app/core/database.py`)
- Standardized error handlers (`AppException`, `StarletteHTTPException`, `RequestValidationError` returning `{detail, code, fields?}`)
- Core models: `User`, `PasswordResetToken`, `LoginAttempt`, `Customer`, `Product`, `ProductVariant`, `Plan`, `TaxRule`, `DiscountRule`, `QuotationTemplate`, `QuotationTemplateLine`, `Subscription`, `SubscriptionLine`, `SubscriptionEvent`, `Invoice`, `InvoiceLine`, `SequenceCounter`
- Alembic migrations configured and verified from clean database through latest migration `d5610eaa994f`
- Pytest configuration with isolated test client and transactional database fixtures

### Milestone 2: Authentication & Identity
- Endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/change-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- Single shared password rule policy (>8 chars, at least one uppercase, lowercase, special character) returning all rule failures
- Duplicate email validation case-insensitively across ALL users (409 Conflict)
- Customer record auto-linking on signup when staff pre-created record without login
- Password reset flow: single-use 30m tokens, SHA-256 hash storage, token invalidation upon use
- Login throttle: 5 failed attempts per 15 mins per email returns 429
- Asynchronous email service with `smtp` and `console` backends
- Idempotent admin user bootstrap on application startup
- Company invoice config endpoint: `GET /api/config/company`

### Milestone 3: Roles & Access Control
- Strict RBAC enforced with `require_roles` dependency (`admin`, `staff`, `customer`)
- Admin-only staff management (`/api/staff`: list, create, get, update, soft delete)
- Staff and admin customer management (`/api/customers`: list with search & pagination, create, get, update, soft delete)
- Customer portal (`/api/portal`: view & update own contact/billing details; foreign customer records return 404, not 403)

### Milestone 4: Product & Service Catalog
- Products & Variants (`/api/products`): effective variant pricing calculation, Brand = Odoo adds 560 INR (56000 paise) verified, duplicate variant constraint enforcement. Admin writes, staff reads.
- Subscription Plans (`/api/plans`): base recurring price in paise, billing periods, min quantity, date range validation (`available_to >= available_from`), and the 4 plan flags (`auto_close`, `closable`, `pausable`, `renewable`). Admin writes, staff reads.
- Tax Rules & Resolution (`/api/taxes`): rates in basis points, scope hierarchy resolution (`product` beats `product_type` beats `all`), tax resolution endpoint `/api/taxes/resolve/{product_id}`. Admin writes, staff reads.
- Discount Rules (`/api/discounts`): fixed paise / percentage basis points, min amounts/quantities, start/end dates, usage limits, dynamic computed statuses (`active`, `scheduled`, `expired`, `exhausted`). Admin writes, staff reads.
- Quotation Templates (`/api/quotation-templates`): managed by both Admin and Staff, linking plan and multiple product/variant lines with line unit prices in paise.

### Milestone 6: Subscriptions Lifecycle & State Machine
- Atomic sequence generation: `BL-00001` padded numbering via transactional counter.
- Subscription models & relationships: `customer`, `plan`, `lines`, `subscription_events` history log.
- Contract locking: header and lines locked after `draft` / `quotation` stages; returns 409 Conflict.
- Add-on line flexibility: lines with product type `add_on` can be added and toggled on/off while contract is `active`. Changes take effect on next invoice without proration.
- Create from quotation template endpoint: `POST /api/subscriptions/create-from-template`.
- State machine transitions with descriptive 409 messages on invalid transitions.
- Pause & Resume: checks `plan.pausable`. Paused subscriptions excluded from billing; resuming resets `next_billing_date` to today if past due.
- Renewal: extends `expiry_date` by $N$ billing periods (1 to 36). Enforces `plan.renewable`.
- Kanban board endpoint: `GET /api/subscriptions/board` returns card counts and top 20 recent cards per status.

### Milestone 7: Pure Pricing Pipeline & In-Process Scheduler
- Pure pricing pipeline (`backend/app/services/pricing.py`):
  * Builds plan fee line (if `plan.price > 0`) and enabled product lines.
  * Evaluates discount rules (date validity, thresholds, product scope, usage limit).
  * Enforces no stacking: picks discount with largest saving (ties broken by lowest ID).
  * Proportional line discount allocation with single-paise rounding remainder absorbed by last line.
  * Line tax resolution using effective tax rate hierarchy snapshot.
  * Invoice line totals equal invoice grand totals exactly.
- Atomic discount usage: conditional update (`UPDATE ... WHERE used_count < usage_limit`); retries calculation without discount if exhausted.
- Unpaid invoice cancellation releases discount usage count.
- In-process APScheduler daily maintenance: activates confirmed subscriptions when `start_date` reached, auto-closes expired active subscriptions with `plan.auto_close`, and triggers advance billing.
- Manual trigger endpoint for admin: `POST /api/system/run-daily`.

### Milestone 8: Advance Billing Engine & Invoices
- Advance billing engine (`POST /api/billing/run`):
  * Safely calculates advance billing periods using `relativedelta` relative to original `start_date` to prevent month-end drift.
  * Database constraint `UNIQUE(subscription_id, period_start)` guarantees idempotency and prevents duplicate invoices.
  * Processes subscriptions in batches of 200; catches up to 60 missed periods per run.
  * Excludes paused subscriptions; skips already-billed periods cleanly.
- Invoice lifecycle:
  * Number sequence `INV-YYYY-XXXXX`.
  * Confirm draft invoice to posted status (`/api/invoices/{id}/confirm`).
  * Cancel invoice with automatic discount usage release (`/api/invoices/{id}/cancel`).
  * Send invoice email notification with payment reminder when overdue (`/api/invoices/{id}/send`).
  * Printable JSON view with full company details (`/api/invoices/{id}/print`).
  * Bulk operations (`confirm`, `send`, `cancel`) for up to 500 invoices (`/api/invoices/bulk-action`).
  * Overdue indicators: dynamically calculated `is_overdue` and `days_overdue`.
  * Strict customer portal isolation: customers can only view their own non-draft invoices and subscriptions (returns 404 for unowned/draft items).

### Milestone 9: Payments & Atomic Concurrency Control
- Payments model with method (`cash`, `card`, `upi`, `bank_transfer`, `cheque`), integer paise amount, and payment date validation (cannot be in the future).
- Single-statement atomic conditional `UPDATE` on invoice balance before inserting the payment record. If the update affects 0 rows, rolls back and raises 409 Conflict. Guarantees zero race conditions or concurrent overpayment without table-level locking.
- Transitions invoice status to `paid` atomically when balance reaches 0.
- Customer invoice detail `/api/invoices/{id}` includes nested payment history.
- `/api/payments` list endpoint with filters, sorting, and customer tenant scoping.

### Milestone 10: Financial & Business Analytics Reports
- `GET /api/reports/summary` using SQL aggregates only:
  * Active subscriptions count and normalized MRR (daily x 365/12, weekly x 52/12, monthly x 1, yearly / 12) calculated in integer paise.
  * Revenue collected, invoiced total, outstanding/overdue balances and counts.
  * Point-in-time point aggregates and exact previous-period comparisons.
  * Status breakdowns for subscriptions, invoices, and payments by method.
  * Short in-process memory cache cleared on any mutation.
- `GET /api/reports/revenue-by-month`:
  * Evaluates confirmed and paid revenue across historical calendar months.
  * Accurately splits revenue into subscription base charges and add-on products (`product.type == 'add_on'`).

### Milestone 11: Global Multi-Tenant Search
- `GET /api/search?q=` returns top 5 customers, subscriptions, and invoices.
- Strict role scoping: customers only see their own customer record, non-draft subscriptions, and non-draft invoices.
- Staff and admin search across full system with case-insensitive partial matching.

### Milestone 12: High-Performance Database Seeder
- Command `python -m app.seed 5000` seeds 5,000 subscriptions, 30,000 invoices, 27,038 payments, 300 Indian enterprise customers, 12 products, and dev logins in **6.66 seconds** (well within 90-second SLA).
- Strict adherence to business rules: `balance == total - amount_paid`, paid invoices have `balance == 0`, no duplicate `(subscription_id, period_start)`.
- Pre-configured dev credentials documented in `docs/DEV_ACCOUNTS.md`.

### Milestone 13: Database Indexing & Benchmark Verification
- Composite and single-column indexes on critical filter, sort, join, and aggregate columns. Verified with `EXPLAIN QUERY PLAN`.
- Benchmark on 5,000 subscriptions and 30,000 invoices:
  * All 10 core endpoints achieve **p95 < 150 ms** across 20 iterations each (target < 500 ms, hard limit < 2,000 ms).
  * Full advance billing run over 150 active subscriptions completes in **~10.8 seconds** with 0 errors.
- Documented in `docs/PERFORMANCE.md`.

## How to Run
```bash
# Backend setup
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed 5000
uvicorn app.main:app --reload
```

## Running Tests
```bash
pytest backend/tests -v
```
Currently: **51 passing tests**, covering complete role matrix, pricing mathematics, state machines, billing engine, payment concurrency, report aggregates, search scoping, and performance SLA benchmarks.

## What is Next
- Part 4: Frontend application (Kanban board, subscriptions management, invoicing, customer portal).
