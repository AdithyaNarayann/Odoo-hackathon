# Project State

## What is Done
- Repository initialized with `.gitignore` and `docs/AGENT_RULES.md`
- Working rules and conventions documented
- Decisions logged in `docs/DECISIONS.md` (DEC-001 through DEC-018)
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

### Milestone 14: Frontend Design System & Component Library (Part 4)
- React 18, React Router 6, TanStack Query 5, Tailwind CSS 3, Recharts, Lucide React.
- Faithfully reproduces the Neo-Brutalist retro aesthetic from component sheet (`media_1793430140979_b71a496a.jpg`):
  * Cream background (`#F4EFE6`), lighter cream cards, near-black ink (`#1A1A1A`), orange primary (`#FF5B26`), dark teal secondary (`#008080`), slate blue (`#5C768D`), amber (`#F59E0B`), black (`#18181B`).
  * 2px ink borders, hard offset shadows (`shadow-neo`, `shadow-neo-sm`, `shadow-neo-md`), Anton typography for large headlines, Archivo 800 uppercase for section titles, Inter for body, tabular numerals for currency.
- 17 pure custom components built from scratch without external component libraries:
  * `Button` (primary, secondary, success, danger, ghost, icon)
  * `Input` (default, focused, error with icon, leading icon)
  * `Select` (custom neo-brutalist dropdown with orange row highlight)
  * `Toggle` (neo-brutalist switch)
  * `Checkbox` (2px border, orange fill with checkmark)
  * `Radio` (2px border, orange dot)
  * `Tabs` (orange pill active tab with hard shadow)
  * `Badge` (Draft grey, Quotation slate blue, Confirmed amber, Active teal, Closed black, Paused outlined grey, Paid teal, Overdue orange, Cancelled black)
  * `StatCard` (with orange highlight variant from sheet)
  * `DataTable` (sortable columns, selectable rows, action menu, skeleton loading)
  * `Pagination` (prev/next, orange active square)
  * `ProgressBar` (track with 2px border, orange/teal fill)
  * `Toast` (success, info, warning, error with automatic 403 listener)
  * `Modal` (confirmation dialog with icon and action buttons)
  * `EmptyState` (document outline icon, bold title, call-to-action)
  * `Tooltip` (dark neo-brutalist popover card with arrow)
  * `Skeleton` (pulsating placeholder card)

### Milestone 15: Auth, Guards & Responsive Navigation Shell
- Complete authentication flow:
  * `LoginPage` with credentials entry, password toggle, quick demo account shortcuts.
  * `SignupPage` with live 5-point password and email checklist (`>8 chars`, uppercase, lowercase, special char, valid email format) and inline duplicate email error on 409.
  * `ForgotPasswordPage` with generic success message.
  * `ResetPasswordPage` with token validation and live password security policy rules.
- Route guards (`ProtectedRoute`) enforcing authentication and role matrix (`admin`, `staff`, `customer`).
- Fetch client wrapper automatically attaching JWT from `localStorage`, sending 401 unauthenticated requests to login, and emitting 403 forbidden toast events.
- Shell layout (`AppLayout`, `Sidebar`, `Topbar`):
  * Sidebar: brand header, orange pill active item, bottom block with geometric art and "BRIGHTLOOP SUBSCRIPTION SYSTEM V1.0". Role-scoped (customers only see My Subscriptions, My Invoices, Profile; staff/admin see all).
  * Mobile responsive drawer with backdrop and hamburger trigger.
  * Topbar: user avatar initials, full name, role badge, profile dropdown menu. Non-functional search box and notification bell omitted per prompt specification.

### Milestone 16: Business Dashboard & Revenue Analytics
- `DashboardPage` (`/dashboard`):
  * Orange hero banner "SUBSCRIPTIONS THAT GROW" with geometric isometric art, tagline, and "+ New Subscription" quick-action link.
  * 4 StatCards populated from `GET /api/reports/summary`: Active Subscriptions, Monthly Recurring Revenue (orange highlight variant with `formatPaiseCompact` e.g. `₹ 12.4L`), Revenue Collected (with trend indicator comparing previous period), Outstanding Invoices (with count and overdue amount).
  * Recharts stacked bar chart for Revenue Overview (`GET /api/reports/revenue-by-month?months=N`): orange bars for Subscriptions, teal bars for Add-ons, responsive container, currency tooltips, and 6m/8m/12m period selector.
  * Recent Subscriptions feed (5 latest subscriptions from `GET /api/subscriptions?page=1&page_size=5` with status badge, customer name, MRR, date, and "View All" link).

### Milestone 17: Customers Management & Detailed Ledgers
- `CustomersListPage` (`/customers`): search, server-side pagination, sorting, status filter, Add Customer modal, row action menu (View Details, Edit Profile, Deactivate/Reactivate).
- `CustomerDetailPage` (`/customers/:id`):
  * Header card with customer initials, active status badge, edit profile modal, and new subscription button.
  * Top metrics row: Lifetime Value (LTV), Active Subscriptions, Total Invoiced, Outstanding Balance.
  * Tabbed views:
    - Overview: full contact details, billing address, GSTIN / Tax ID, account metadata.
    - Subscriptions: customer's subscriptions table with status badges and recurring subtotals.
    - Invoices: customer's billing invoices table with due dates, overdue badges, and balance due.

### Milestone 18: Product Catalog, Plans & Quotation Templates
- `ProductsPage` (`/products`):
  * List with search, type filter, status filter, and pagination.
  * Margin display: calculated profit margin and percentage with color indicators.
  * Variants editor (e.g. Brand = Odoo +560) showing live effective price (sales price + variant extra).
  * Role permissions: Admin can create, edit, deactivate; Staff gets read-only access.
- `PlansPage` (`/plans`):
  * List with billing cycle, base fee, minimum quantity, availability window, and status.
  * 4 flag Toggles (`auto_close`, `closable`, `pausable`, `renewable`), each with an explanatory Tooltip detailing contract lifecycle policy.
  * Admin write, staff read-only.
- `TemplatesPage` (`/templates`):
  * List with linked plan, validity days, and pre-configured items count.
  * Line items editor: select product, select variant, set quantity, live line total calculation.
  * Admin and staff can create and edit.

### Milestone 19: Discounts, Tax Rates & Organization Settings
- `DiscountsPage` (`/discounts`):
  * List with status Badges (Active, Expired, Limit Reached, Inactive) and usage `ProgressBar` ("37 / 100 used").
  * Modal form with `Radio` controls for discount type (percentage vs fixed) and application scope (entire subscription vs specific products).
  * Multi-select product checkboxes, spend thresholds, minimum quantities, date ranges, and usage limits.
  * Admin write, staff read-only.
- `SettingsPage` (`/settings`):
  * Tab 1 (Profile): user identity card and Change Password form with live 5-point password security checklist.
  * Tab 2 (Taxes - Admin Only): tax rules table with rates in %, scope resolution hierarchy (Global all, By product type, By specific product), and create/edit/deactivate modal.
  * Tab 3 (Staff - Admin Only): team members management table, invite/create staff modal, and active status toggle.

### Milestone 20: Cross-Platform Single-Script Dev Server
- Root `package.json` with `concurrently` executing backend (`python -m uvicorn app.main:app --app-dir backend --reload --port 8000`) and frontend (`npm --prefix frontend run dev`) concurrently.
- Compatible with Windows, Linux, and macOS across PowerShell, CMD, and Bash.

### Milestone 21: Subscriptions List & 5-Column Pipeline Board (F1)
- `SubscriptionsListPage` (`/subscriptions`):
  * DataTable with columns: Subscription Number, Customer, Plan, Amount per period, Status Badge, Next Billing, Expiry, and row actions.
  * URL-synced filters for status, plan, customer query, and quick filter "Expiring in 30 days" (`expiring_in_30_days=true`).
  * View toggle switches seamlessly between table and a 5-column Kanban pipeline board (`Draft`, `Quotation`, `Confirmed`, `Active`, `Closed`).
  * Each board column features column header badge with count, cards showing customer, plan, and recurring amount, and "View all N" link syncing directly to filtered table view. Click opens subscription detail.
  * Strict state-machine safety: transitions are executed through detail action buttons rather than drag-and-drop to preserve legal validation rules.

### Milestone 22: Subscription Contract Builder & Line Item Editor (F2)
- `SubscriptionFormPage` (`/subscriptions/new`, `/subscriptions/:id/edit`):
  * Custom contract and template-based creation modes (`POST /api/subscriptions/create-from-template`).
  * Customer selector, plan picker, start date, expiry date, payment terms, and notes.
  * Interactive line item editor with live variant selector, effective unit price snapshot, quantity validation enforcing `plan.min_quantity`, current tax rule resolution, and line amount computation.
  * Real-time running totals calculation (subtotal, taxes, recurring subtotal) matching backend pricing pipeline.
  * Inline validation errors mapped cleanly to corresponding fields.

### Milestone 23: Subscription Detail, Status Stepper & Legal Actions (F3)
- `SubscriptionDetailPage` (`/subscriptions/:id`):
  * Header card with subscription number, status badge, pause indicator, customer link, and plan terms.
  * Status Stepper (`Draft` → `Quotation` → `Confirmed` → `Active` → `Closed`) tracking contract progression.
  * Dynamic action buttons strictly scoped to user role, current state, and plan lifecycle flags:
    - Draft → Quotation (`Send Quotation`)
    - Quotation → Draft (`Revise`)
    - Quotation → Confirmed (`Confirm Contract`)
    - Confirmed → Active (`Activate Now` if start date reached)
    - Active → Paused / Paused → Active (`Pause` / `Resume` based on `plan.pausable`)
    - Active → Closed (`Close Contract` based on `plan.closable`)
    - Renewal Modal (1 to 36 periods based on `plan.renewable`)
    - Add-on Lines management: toggle existing add-ons on/off via `Toggle`, or add new add-on lines to an Active contract without proration.
  * Dry-Run Next Invoice Preview panel (`GET /api/subscriptions/:id/preview-next-invoice`) showing upcoming invoice lines, discounts applied, and taxes.
  * Audit activity timeline logging every state transition, pause/resume, and line modification.

### Milestone 24: Advance Billing Run & Dry-Run Simulator (F4)
- `BillingRunPage` (`/billing`):
  * As-of date selector for advance billing simulations.
  * Dry-Run Preview (`POST /api/billing/run?dry_run=true`) returning eligible subscriptions count, invoice lines, and estimated total in integer paise.
  * Confirmation modal and neo-brutalist animated `ProgressBar` during execution.
  * Results panel detailing invoices created, skipped periods, catch-up batches, and idempotency guarantees.

### Milestone 25: Invoices Management, Bulk Operations & Printable Invoices (F5)
- `InvoicesListPage` (`/invoices`):
  * Dynamic status tabs (`All`, `Draft`, `Confirmed`, `Paid`, `Overdue`, `Outstanding`) with real-time counts.
  * Row selection with multi-invoice bulk action modal (`Confirm All`, `Send All`, `Cancel All`) returning individual row status results.
- `InvoiceDetailPage` (`/invoices/:id`):
  * Invoice summary, payment status, customer billing information, line items breakdown, taxes, and applied discounts.
  * Payment ledger displaying all partial/full payments recorded against the invoice.
  * Record payment modal with automated balance prefill and atomic conflict protection.
- `InvoicePrintPage` (`/invoices/:id/print`, `/portal/invoices/:id/print`):
  * Clean white print stylesheet (`@media print`) stripping navigation shell, borders, and shadows.
  * Formal business layout with company metadata, customer billing details, itemized tax breakdowns, and payment history.
  * Triggered via button or automatic print dialog.

### Milestone 26: Payments Ledger & Atomic Reconciliation (F6)
- `PaymentsListPage` (`/payments`):
  * Financial reconciliation table displaying payment date, invoice reference, customer, payment method badge (`cash`, `card`, `upi`, `bank_transfer`, `cheque`), and amount.
  * Summary cards for Total Paid vs Outstanding Balance.
  * Date range, method, and customer search filters.
  * Record Payment modal allowing staff and admin to record payments against any confirmed invoice with live balance updates.

### Milestone 27: Financial Reports & Overdue Reminders (F7)
- `ReportsPage` (`/reports`):
  * Period selector (`from`, `to`) and customer/plan filters.
  * 6 KPI StatCards: Active Subscriptions, Normalized Monthly Recurring Revenue (MRR), Total Invoiced, Revenue Collected (with period comparison), Outstanding Invoices, and Expiring Subscriptions.
  * Recharts stacked bar chart of historical revenue split into base subscription charges vs add-on products.
  * Payments distribution breakdown by payment method.
  * Tabbed table breakdown for Subscriptions by Status, Invoices by Status, and Overdue Invoices with per-row "Send Payment Reminder" quick action.

### Milestone 28: Global Search & Real-Time Notification Bell (F8)
- `Topbar` navigation integration:
  * Global Search with `Ctrl+K` shortcut, 300 ms debounce, arrow key navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), and tenant isolation.
  * Grouped results popover (Customers, Subscriptions, Invoices) with direct routing.
  * Notification Bell with live badge indicator for overdue invoices count.
  * Dropdown displaying top 5 overdue invoices with customer name, days overdue, and amount due.

### Milestone 29: Customer Self-Service Portal (F9)
- `CustomerSubscriptionsPage` (`/portal/subscriptions`):
  * Role-scoped view of active, quotation, confirmed, and closed subscriptions (omits draft contracts).
  * Direct customer self-service actions: confirm quotation, pause/resume subscription (if plan allows), close subscription (if plan allows), and toggle add-on services.
- `CustomerProfilePage` (`/portal/profile`):
  * Read/write customer company and billing details via `/api/portal/me`.
  * Security section with Change Password form enforcing strict 5-rule policy with live visual checklist.
- Reuses `InvoicesListPage` and `InvoicePrintPage` with customer role scoping: only confirmed and paid invoices are displayed.

### Milestone 30: Responsive Polish, Empty States & Resilient Error Boundary (F10)
- Tablet navigation: sidebar transforms into an icon rail on medium screens (`md:w-16 lg:w-64`) with centered icons and tooltips.
- Mobile navigation: responsive slide-out drawer with ink backdrop on mobile screens (`< 768px`).
- Neo-brutalist empty states for zero-data conditions across all tables and feeds.
- Pulsating skeleton loaders during async query execution.
- Global `ErrorBoundary` catching uncaught render exceptions with reload and return home actions.

## How to Run
```bash
# 1. Install root, backend, and frontend dependencies
npm install
npm --prefix frontend install
pip install -r backend/requirements.txt

# 2. Run backend database migrations and seed 5,000 subscriptions
alembic upgrade head
python -m app.seed 5000

# 3. Start full stack development server (backend on :8000, frontend on :3000)
npm run dev
```

## Running Tests
```bash
# Backend test suite (51 passing tests covering auth, catalog, state machine, billing, concurrency, reports)
pytest backend/tests -v

# Frontend production build verification
npm run build:frontend
```

## What is Next
- All functional and architectural requirements in the specification are fully implemented, verified, and tested. Ready for final evaluation and production deployment.
