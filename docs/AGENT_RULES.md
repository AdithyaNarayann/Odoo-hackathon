WORKING RULES
1. Git: run git init if needed, add a proper .gitignore (python, node, venv, dist, .env, database files), make an initial commit. Then commit after EVERY logical change (each model group, endpoint group, service, test file, bug fix, doc update) as soon as it runs or its tests pass. Never batch, never save work for one final commit. Use Conventional Commits with specific messages, for example feat(auth): add signup with password policy, fix(billing): ..., test(...): ..., docs(...): .... If a remote named origin exists, push after each commit and carry on if a push fails. Never force push or rewrite history. Never commit secrets, .env files or database files. If git user.name or user.email is unset, set repo-local values (Narayan, narayan@example.com).
2. Verify by running: after each milestone start the app, call the endpoints, run pytest, fix failures, then commit.
3. Keep docs current: docs/STATE.md (what is done, how to run, what is next), docs/DECISIONS.md (every interpretation), docs/API.md (every endpoint with method, path, allowed roles, request and response shape).
4. Build only what the PDF asks for. No placeholder features, no fake data inside the product, no unused code.
5. Keep chat output short.

CONVENTIONS
- Money: integer paise everywhere (database, API, logic), currency INR. Rounding is half up, applied once per line. Never floats.
- Dates: business dates are calendar dates in APP_TIMEZONE (default Asia/Kolkata). Timestamps are stored in UTC.
- Lists return {items, total, page, page_size}, with server-side pagination (default 25, max 100), whitelisted sorting and filters as query params.
- Errors return {detail, code, fields?} with correct HTTP codes (401, 403, 404, 409, 422).
- No N+1 queries. Every filter and sort column used by a list endpoint is indexed.
- Soft delete with is_active for anything referenced by history (users, customers, products, plans, taxes). Never hard delete referenced rows.
- Portable SQL: SQLAlchemy only, nothing SQLite-specific, so PostgreSQL works by changing DATABASE_URL.
- All configuration through environment variables (pydantic-settings) with a committed .env.example. No secrets in code.
