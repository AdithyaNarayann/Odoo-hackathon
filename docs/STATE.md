# Project State

## What is Done
- Repository initialized with `.gitignore` and `docs/AGENT_RULES.md`
- Working rules and conventions documented
- Initial decisions logged in `docs/DECISIONS.md`

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
- Milestone 1: Backend scaffolding, configuration (`pydantic-settings`), SQLite WAL/PostgreSQL database engine, Alembic migrations setup, standardized error handlers.
- Milestone 2: Identity, bcrypt authentication, password policy, login rate throttling, email service (SMTP + console), admin bootstrap on startup.
- Milestone 3: Roles & RBAC (`admin`, `staff`, `customer`), staff management endpoints, customer management and portal endpoints.
- Milestone 4: Product catalog (products, variants, 560 INR add-on pricing), subscription plans, hierarchical tax rules, discount rules with computed statuses, quotation templates.
- Milestone 5: Full test suite verification across all matrices, API documentation finalization, tagging `part-1-complete`.
