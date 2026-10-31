# Development & Default Accounts

The Brightloop Subscription Management System includes standard default accounts pre-configured to pass the strict password security policy (>8 chars, uppercase, lowercase, special character).

These accounts are initialized automatically on startup (`SEED_DEFAULT_ACCOUNTS=true`) and preserved across seed operations.

---

## 1. Default Accounts (Standard Evaluation Credentials)

| Role | Email | Password | Scope & Description |
|---|---|---|---|
| **Admin** | `admin@brightloop.com` | `Admin@1234` | Full system control: catalog, taxes, discounts, staff administration, advance billing engine, financial reports. |
| **Staff** | `staff@brightloop.com` | `Staff@1234` | Daily operations: customers, quotation templates, subscription management, invoices, payment recording, reports. Read-only on catalog and staff. |
| **Customer** | `customer@brightloop.com` | `Customer@1234` | Customer Self-Service Portal. Linked to **Demo Traders** with subscriptions in all 5 statuses (`Draft`, `Quotation`, `Confirmed`, `Active`, `Closed`), invoices (`Draft`, `Confirmed`, `Paid`, `Overdue`), and payments. |

---

## 2. Seeded Enterprise Accounts (Extended Dataset)

When running `npm run db:seed` or `npm run db:seed:full`, additional sample accounts are created for scale testing:

| Role | Email | Password | Details |
|---|---|---|---|
| **Admin** | `admin@brightloop.io` | `Admin@Brightloop2026` | Alternative administrative login |
| **Staff 1** | `staff1@brightloop.io` | `Staff@Brightloop2026` | Operations staff member |
| **Staff 2** | `staff2@brightloop.io` | `Staff@Brightloop2026` | Operations staff member |
| **Customers (1-300)** | `customer1@brightloop.io` ... | `Cust@Brightloop2026` | Enterprise accounts linked to Indian enterprise customer profiles |

---

## 3. Quick Run Commands

```bash
# Setup clean environment, venv, deps, migrations, and default accounts
npm run setup

# Start full-stack application (Backend on :8000, Frontend on :5173)
npm run dev

# Reset database and reload sample data
npm run db:reset

# Seed sample dataset (~200 subscriptions)
npm run db:seed

# Seed high-volume performance dataset (5,000 subscriptions)
npm run db:seed:full

# Run test suite
npm run test
```
