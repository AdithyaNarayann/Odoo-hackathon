# Development Accounts

These pre-configured credentials are created by `python -m app.seed`.

All passwords adhere strictly to the Brightloop security policy (>8 chars, uppercase, lowercase, special character).

---

## 1. System Administrator
- **Email**: `admin@brightloop.io`
- **Password**: `Admin@Brightloop2026`
- **Role**: `admin`
- **Access**: Full system administration, catalog management, staff management, financial reports, advance billing engine.

---

## 2. Staff Accounts
- **Staff 1**:
  - **Email**: `staff1@brightloop.io`
  - **Password**: `Staff@Brightloop2026`
  - **Role**: `staff`
  - **Access**: Customer management, quotation templates, subscription operations, invoicing, payment recording, reports.
- **Staff 2**:
  - **Email**: `staff2@brightloop.io`
  - **Password**: `Staff@Brightloop2026`
  - **Role**: `staff`
  - **Access**: Customer management, quotation templates, subscription operations, invoicing, payment recording, reports.

---

## 3. Customer Accounts (Customer Portal)
Password for all test customers: `Cust@Brightloop2026`

| Account | Email | Password | Linked Customer ID |
|---|---|---|---|
| Customer 1 | `customer1@brightloop.io` | `Cust@Brightloop2026` | 1 |
| Customer 2 | `customer2@brightloop.io` | `Cust@Brightloop2026` | 2 |
| Customer 3 | `customer3@brightloop.io` | `Cust@Brightloop2026` | 3 |
| Customer 4 | `customer4@brightloop.io` | `Cust@Brightloop2026` | 4 |
| Customer 5 | `customer5@brightloop.io` | `Cust@Brightloop2026` | 5 |
| Customer 6 | `customer6@brightloop.io` | `Cust@Brightloop2026` | 6 |
| Customer 7 | `customer7@brightloop.io` | `Cust@Brightloop2026` | 7 |
| Customer 8 | `customer8@brightloop.io` | `Cust@Brightloop2026` | 8 |
| Customer 9 | `customer9@brightloop.io` | `Cust@Brightloop2026` | 9 |
| Customer 10 | `customer10@brightloop.io` | `Cust@Brightloop2026` | 10 |

---

## Usage Example
```bash
# Obtain JWT token via login endpoint
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@brightloop.io", "password": "Admin@Brightloop2026"}'
```
