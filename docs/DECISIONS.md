# Decisions Log

| Decision ID | Area | Decision | Reason |
|-------------|------|----------|--------|
| DEC-001 | Auth | Email uniqueness enforced case-insensitively using lowercase normalization at schema & model level | Prevent duplicate accounts through casing variations while adhering to RFC 5321 in practice |
| DEC-002 | Database | SQLite WAL mode & busy_timeout configured for local dev; portable SQLAlchemy dialect types used | Ensure smooth concurrency on Windows/Linux without table lock timeouts |
| DEC-003 | Auth | Single-use password reset tokens stored as SHA256 hashes with 30m expiry | Never store raw reset tokens; quick revocation upon use |
| DEC-004 | Catalog | Tax rules precedence: product > product_type > all | Standard tax priority hierarchy to allow specific overrides over generic rates |
| DEC-005 | Pricing | Integer paise calculations with half-up rounding (`ROUND_HALF_UP`) applied once per line | Prevents cumulative floating point errors and adheres to INR paise convention |
| DEC-006 | Customer Portal | Portal access restricted strictly to customer's linked customer record; queries return 404 for any unowned entity | Prevents ID enumeration and unauthorized data inspection |
