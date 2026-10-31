# Project State

## What is Done
- Repository initialized with `.gitignore` and `docs/AGENT_RULES.md`
- Working rules and conventions documented
- Decisions logged in `docs/DECISIONS.md` (DEC-001 through DEC-012)
- API specification documented in `docs/API.md`

### Milestone 1: Core Scaffolding & Database
- Application structure: `backend/app` (core, models, schemas, routers, services), `backend/tests`, `frontend`, `scripts`, `docs`
- Configuration with `pydantic-settings` (`backend/app/core/config.py`) and committed `.env.example`
- SQLAlchemy 2.0 database engine with SQLite WAL mode & 5000ms busy_timeout (`backend/app/core/database.py`)
- Standardized error handlers (`AppException`, `StarletteHTTPException`, `RequestValidationError` returning `{detail, code, fields?}`)
- Core models: `User`, `PasswordResetToken`, `LoginAttempt`, `Customer`, `Product`, `ProductVariant`, `Plan`, `TaxRule`, `DiscountRule`, `QuotationTemplate`, `QuotationTemplateLine`
- Alembic migrations configured and verified from clean database
- Pytest configuration with isolated test client and in-memory database

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

### Milestone 5: Verification & Quality Assurance
- Exhaustive test suite (19 test cases) passing across all rule matrices:
  * Password rule matrix (length, upper, lower, special, compound)
  * Duplicate email case-insensitivity
  * Signup linking to existing customer
  * Reset token single-use & expiry
  * Login rate throttle
  * Complete route-by-route role permission matrix
  * Customer portal isolation (404 for unowned entities)
  * Catalog validation & plan dates
  * Hierarchical tax resolution
  * Variant pricing with 560 INR example
  * Discount status computations
- End-to-end verification script (`scripts/verify_app.py`) verified live against FastAPI application

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
uvicorn app.main:app --reload
```

## Running Tests
```bash
pytest backend/tests -v
```

## What is Next
- Part 2: Subscriptions lifecycle, recurring invoicing, and payment processing.
