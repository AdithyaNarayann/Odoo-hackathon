# Decisions Log

| Decision ID | Area | Decision | Reason |
|-------------|------|----------|--------|
| DEC-001 | Auth | Email uniqueness enforced case-insensitively using lowercase normalization at schema & model level | Prevent duplicate accounts through casing variations while adhering to RFC 5321 in practice |
| DEC-002 | Database | SQLite WAL mode & busy_timeout configured for local dev; portable SQLAlchemy dialect types used | Ensure smooth concurrency on Windows/Linux without table lock timeouts |
| DEC-003 | Auth | Single-use password reset tokens stored as SHA256 hashes with 30m expiry | Never store raw reset tokens; quick revocation upon use |
| DEC-004 | Catalog | Tax rules precedence: product > product_type > all | Standard tax priority hierarchy to allow specific overrides over generic rates |
| DEC-005 | Pricing | Integer paise calculations with half-up rounding (`ROUND_HALF_UP`) applied once per line | Prevents cumulative floating point errors and adheres to INR paise convention |
| DEC-006 | Customer Portal | Portal access restricted strictly to customer's linked customer record; queries return 404 for any unowned entity | Prevents ID enumeration and unauthorized data inspection |
| DEC-007 | Auth | Login throttling persisted in database table `login_attempts` | Retains throttle integrity across server reboots without relying on in-memory counters |
| DEC-008 | Auth | Admin bootstrap on startup checks for existing admin role before creating default admin | Idempotent startup logic that safely initializes admin if env credentials are provided |
| DEC-009 | Catalog | Quotation templates editable by both Admin and Staff, whereas products/plans/taxes/discounts are Admin write-only | Staff need ability to draft quotations while core financial catalog parameters remain locked |
| DEC-010 | Catalog | Discount rule status dynamically calculated on request using business calendar date and usage counts | Avoids cron/daemon synchronization lag and keeps rule statuses strictly accurate in real time |
| DEC-011 | Catalog | Deactivated discount rules compute status as "expired" | Prevents applying inactive discounts while preserving audit trails |
| DEC-012 | Auth | All outstanding reset tokens for user marked used upon successful password reset | Prevents token replay and closes open reset windows immediately |
| DEC-013 | Billing | Advance billing month-end arithmetic uses `relativedelta` relative to the subscription's original `start_date` | Prevents calendar month-end day truncation drift (e.g., Jan 31 -> Feb 28 -> Mar 31) across billing cycles |
| DEC-014 | Pricing | Plan recurring fee lines resolve taxes against active `scope='all'` tax rules (or 0 rate if none found) | Base subscription plan charges do not have a product ID/category, so generic tax scope applies |
| DEC-015 | Pricing | Proportional line discount rounding remainder allocated strictly to the last eligible line | Guarantees sum of invoice line discounts matches total discount exactly with zero paise discrepancy |
| DEC-016 | Payments | Single-statement conditional atomic `UPDATE` on invoice balance before inserting payment | Guarantees zero race conditions and eliminates concurrent overpayment without table-level locking |
| DEC-017 | Reports | MRR calculation groups by `billing_period` in SQL with exact half-up monthly normalization in integer paise | Eliminates N+1 queries across thousands of active contracts while maintaining database portability |
| DEC-018 | Search | Global search limits items to 5 per entity type and strictly enforces customer role tenant scoping | Delivers <30ms search latency across 35,000+ entities while guaranteeing multi-tenant security |
