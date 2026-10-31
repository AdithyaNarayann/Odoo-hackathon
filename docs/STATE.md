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
- Milestone 3: Roles & RBAC (`admin`, `staff`, `customer`), staff management endpoints, customer management and portal endpoints.
- Milestone 4: Product catalog (products, variants, 560 INR add-on pricing), subscription plans, hierarchical tax rules, discount rules with computed statuses, quotation templates.
- Milestone 5: Full test suite verification across all matrices, API documentation finalization, tagging `part-1-complete`.
