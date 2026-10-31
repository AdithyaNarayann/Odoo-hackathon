# Bug Tracker

This document logs every bug identified, root cause, fix, and associated git commit during the repair and stabilization of the Brightloop Subscription Management System.

| Bug ID | Symptom | Root Cause | Fix | Commit |
|---|---|---|---|---|
| BUG-001 | Fresh venv setup failed with `ModuleNotFoundError: No module named 'pytz'` during migrations. | `pytz` was used in `backend/app/models/catalog.py` and `reports.py` but absent from `requirements.txt`. | Added `pytz>=2024.1` to `backend/requirements.txt`. | `b2a09a6` |
| BUG-002 | Default demo logins were missing or incomplete on startup; customer was unlinked to "Demo Traders" without sample subscriptions in all 5 statuses. | Startup lifespan didn't seed default accounts deterministically with required test fixtures. | Added `ensure_default_accounts` in `backend/app/services/bootstrap.py` called in lifespan. | `b2a09a6` |
| BUG-003 | Windows path with spaces broken in command execution when running dev/setup. | Shell execution splitting commands on whitespace. | Created cross-platform `scripts/setup.mjs` and `scripts/dev.mjs` using `spawnSync`/`spawn` with explicit argument arrays. | `b2a09a6` |
| BUG-004 | Invoices router had static route `/bulk-action` defined after parameterized route `/{id}`. | Suboptimal route declaration ordering in FastAPI APIRouter. | Moved static route `/bulk-action` before parameterized route `/{id}`. | `58211de` |
| BUG-005 | Passwords exceeding 72 bytes could fail unexpectedly in bcrypt without clear 422 validation. | Missing bcrypt 72-byte limit enforcement in `check_password_rules` and `hash_password`. | Added explicit byte-length validation <= 72 bytes rejecting oversized passwords with 422. | `58211de` |

