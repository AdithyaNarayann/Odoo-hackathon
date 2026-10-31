# Bug Tracker

This document logs every bug identified, root cause, fix, and associated git commit during the repair and stabilization of the Brightloop Subscription Management System.

| Bug ID | Symptom | Root Cause | Fix | Commit |
|---|---|---|---|---|
| BUG-001 | Fresh venv setup failed with `ModuleNotFoundError: No module named 'pytz'` during migrations. | `pytz` was used in `backend/app/models/catalog.py` and `reports.py` but absent from `requirements.txt`. | Added `pytz>=2024.1` to `backend/requirements.txt`. | `b2a09a6` |
| BUG-002 | Default demo logins were missing or incomplete on startup; customer was unlinked to "Demo Traders" without sample subscriptions in all 5 statuses. | Startup lifespan didn't seed default accounts deterministically with required test fixtures. | Added `ensure_default_accounts` in `backend/app/services/bootstrap.py` called in lifespan. | `b2a09a6` |
| BUG-003 | Windows path with spaces broken in command execution when running dev/setup. | Shell execution splitting commands on whitespace. | Created cross-platform `scripts/setup.mjs` and `scripts/dev.mjs` using `spawnSync`/`spawn` with explicit argument arrays. | `b2a09a6` |
| BUG-004 | Invoices router had static route `/bulk-action` defined after parameterized route `/{id}`. | Suboptimal route declaration ordering in FastAPI APIRouter. | Moved static route `/bulk-action` before parameterized route `/{id}`. | `58211de` |
| BUG-005 | Passwords exceeding 72 bytes could fail unexpectedly in bcrypt without clear 422 validation. | Missing bcrypt 72-byte limit enforcement in `check_password_rules` and `hash_password`. | Added explicit byte-length validation <= 72 bytes rejecting oversized passwords with 422. | `58211de` |
| BUG-006 | Premature unauthenticated redirect on page reload before auth revalidation completed. | `IndexRedirect` evaluated `isAuthenticated` while `loading` was true. | Rendered full-screen neo-brutal loading splash in `AuthProvider` and prevented redirect while loading. | `f31ee1e` |
| BUG-007 | Signup redirect did not navigate user to role home. | Signup callback did not utilize `getRoleHome` or redirect replacement. | Standardized `signup` and `login` navigation to `getRoleHome` with `{ replace: true }`. | `f31ee1e` |
| BUG-008 | Customer role was locked out of `/subscriptions` and `/invoices` routes. | Route definitions restricted `/subscriptions` to `admin` and `staff` only. | Opened shared routes to `customer` with role-aware component routing (`CustomerSubscriptionsPage`). | `f31ee1e` |
| BUG-009 | Quick login shortcut buttons on login page used wrong demo emails and passwords. | Hardcoded legacy credentials (`BrightLoop2026!`). | Updated buttons with active credentials (`admin@brightloop.com` / `Admin@1234`, etc.). | `f31ee1e` |
| BUG-010 | Missing top-level root error boundary and missing 404 page. | No catch-all boundary around App and no dedicated 404 view. | Added `ErrorBoundary` at root and created neo-brutal `NotFoundPage`. | `f31ee1e` |
| BUG-011 | Topbar component crashed with `ReferenceError: useMemo is not defined` on all authenticated views. | Missing `useMemo` in React import list in `Topbar.jsx`. | Added `useMemo` to React imports in `frontend/src/components/layout/Topbar.jsx`. | `7a7247d` |
| BUG-012 | Billing Run view crashed with `ReferenceError: formatDate is not defined`. | `formatDate` helper was referenced in template but omitted from `utils/format` import. | Added `formatDate` to imports in `frontend/src/pages/billing/BillingRunPage.jsx`. | `7a7247d` |

