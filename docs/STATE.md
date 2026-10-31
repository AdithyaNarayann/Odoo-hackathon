# Project State

## What is Done
- Repository initialized with `.gitignore` and `docs/AGENT_RULES.md`
- Working rules and conventions documented
- Initial decisions logged in `docs/DECISIONS.md`
- Milestone 1 Complete:
  * Application scaffolding (`backend/app`, `backend/tests`, `frontend`, `scripts`, `docs`)
  * Configuration with `pydantic-settings` (`backend/app/core/config.py`) and `.env.example`
  * SQLAlchemy 2.0 database engine with SQLite WAL & busy_timeout (`backend/app/core/database.py`)
  * Standardized error handlers (`AppException`, `StarletteHTTPException`, `RequestValidationError` returning `{detail, code, fields?}`)
  * Core models (`User`, `Customer`, `Product`, `ProductVariant`, `Plan`, `TaxRule`, `DiscountRule`, `QuotationTemplate`)
  * Alembic migrations configured and initial migration generated and verified
  * Pytest configuration with isolated test client and in-memory database
- Milestone 2 Complete:
  * Authentication & Identity (`/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/change-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`)
  * Single shared password rule policy (>8 chars, uppercase, lowercase, special char)
  * Duplicate email validation case-insensitively with 409 Conflict
  * Pre-existing customer record auto-linking on signup
  * Password reset workflow (single-use 30m tokens, SHA-256 hash storage, token invalidation upon use)
  * Login throttle service (5 failed attempts per 15 mins -> 429)
  * Dual email service backends (console and smtp) with asynchronous background dispatch
  * Admin user bootstrap on startup
  * Company invoice config endpoint (`GET /api/config/company`)
- Milestone 3 Complete:
  * Role-based access control (RBAC) enforced with `require_roles` dependency across all routes (`admin`, `staff`, `customer`)
  * Admin-only staff management (`/api/staff`: list, create, get, update, soft delete)
  * Staff and admin customer management (`/api/customers`: list with search & pagination, create, get, update, soft delete)
  * Customer portal (`/api/portal`: view & update own contact/billing details; strict 404 isolation for foreign customer records)
- Milestone 4 Complete:
  * Catalog Products & Variants (`/api/products`): effective variant pricing calculation, Brand = Odoo adds 560 INR (56000 paise) verified, duplicate variant constraint enforcement. Admin writes, staff reads.
  * Subscription Plans (`/api/plans`): base recurring price in paise, billing periods, min quantity, date range validation (`available_to >= available_from`), and the 4 plan flags (`auto_close`, `closable`, `pausable`, `renewable`).
  * Tax Rules & Resolution (`/api/taxes`): rates in basis points, scope hierarchy resolution (`product` beats `product_type` beats `all`), tax resolution endpoint `/api/taxes/resolve/{product_id}`.
  * Discount Rules (`/api/discounts`): fixed paise / percentage basis points, min amounts/quantities, start/end dates, usage limits, dynamic computed statuses (`active`, `scheduled`, `expired`, `exhausted`).
  * Quotation Templates (`/api/quotation-templates`): managed by both admin and staff, linking plan and multiple product/variant lines with line unit prices in paise.

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
- Milestone 5: Full test suite verification across all matrices, API documentation finalization, tagging `part-1-complete`.
