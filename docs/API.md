# Brightloop Subscription Management System - API Specification

All responses adhere to standard conventions:
- List response shape: `{ "items": [...], "total": int, "page": int, "page_size": int }`
- Error response shape: `{ "detail": str, "code": str, "fields": [...] }`
- Money values are represented in integer paise (1 INR = 100 paise). Rounding is half-up applied once per line.
- Dates: business dates are calendar dates in `APP_TIMEZONE` (default `Asia/Kolkata`). Timestamps are stored in UTC ISO-8601.
- Authentication: Bearer token in header `Authorization: Bearer <access_token>`.

---

## 1. Authentication & Identity (`/api/auth`)

### `POST /api/auth/signup`
- **Allowed Roles**: Public
- **Status**: 201 Created
- **Request Body**:
  ```json
  {
    "full_name": "Alice Wonderland",
    "company_name": "Wonderland Inc",
    "email": "alice@example.com",
    "password": "Valid@Password123"
  }
  ```
- **Response Body**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": {
      "id": 1,
      "email": "alice@example.com",
      "full_name": "Alice Wonderland",
      "role": "customer",
      "is_active": true,
      "customer_id": 1,
      "created_at": "2026-10-31T10:00:00Z"
    }
  }
  ```

### `POST /api/auth/login`
- **Allowed Roles**: Public (Throttled: 5 failed attempts per 15 mins per email returns 429)
- **Status**: 200 OK
- **Request Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "Valid@Password123"
  }
  ```
- **Response Body**: Same as TokenResponse above.

### `GET /api/auth/me`
- **Allowed Roles**: Authenticated (`admin`, `staff`, `customer`)
- **Status**: 200 OK
- **Response Body**: `UserProfileResponse`

### `POST /api/auth/change-password`
- **Allowed Roles**: Authenticated (`admin`, `staff`, `customer`)
- **Status**: 200 OK
- **Request Body**:
  ```json
  {
    "old_password": "Valid@Password123",
    "new_password": "New@Password456"
  }
  ```
- **Response Body**: `{ "detail": "Password changed successfully" }`

### `POST /api/auth/forgot-password`
- **Allowed Roles**: Public (Always returns generic 200 to prevent enumeration)
- **Status**: 200 OK
- **Request Body**: `{ "email": "alice@example.com" }`
- **Response Body**: `{ "detail": "If that email is registered, a password reset link has been sent." }`

### `POST /api/auth/reset-password`
- **Allowed Roles**: Public
- **Status**: 200 OK
- **Request Body**:
  ```json
  {
    "token": "raw-reset-token-from-email",
    "new_password": "New@Password789"
  }
  ```
- **Response Body**: `{ "detail": "Password has been reset successfully. You may now log in." }`

---

## 2. System Configuration (`/api/config`)

### `GET /api/config/company`
- **Allowed Roles**: Authenticated (`admin`, `staff`, `customer`)
- **Status**: 200 OK
- **Response Body**:
  ```json
  {
    "company_name": "Brightloop Technologies Pvt Ltd",
    "company_address": "123 Innovation Way, Tech Park, Bangalore, KA, India",
    "company_tax_id": "GSTIN29ABCDE1234F1Z5",
    "company_email": "billing@brightloop.io",
    "company_phone": "+91 80 1234 5678"
  }
  ```

---

## 3. Staff Management (`/api/staff`)

Allowed exclusively to `admin`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/staff?page=1&page_size=25&search=...&is_active=true&sort_by=id&sort_order=asc` | List staff members |
| `POST` | `/api/staff` | Create new staff account (`full_name`, `email`, `password`, `is_active`) |
| `GET` | `/api/staff/{id}` | Get staff account details |
| `PUT` | `/api/staff/{id}` | Update staff member (`full_name`, `password`, `is_active`) |
| `DELETE` | `/api/staff/{id}` | Soft delete staff member (`is_active = false`) |

---

## 4. Customers (`/api/customers`) & Portal (`/api/portal`)

### Customer Management (`/api/customers`)
Allowed to `admin` and `staff`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customers?page=1&page_size=25&search=...&is_active=true` | List customers with server pagination & search |
| `POST` | `/api/customers` | Create customer profile |
| `GET` | `/api/customers/{id}` | Get customer profile details |
| `PUT` | `/api/customers/{id}` | Update customer profile details |
| `DELETE` | `/api/customers/{id}` | Soft delete customer (`is_active = false`) |

### Customer Portal (`/api/portal`)
Allowed to `customer`. Strictly isolated to own customer record.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/portal/me` | View own customer contact & billing profile |
| `PUT` | `/api/portal/me` | Update own customer contact & billing profile |
| `GET` | `/api/portal/customer/{customer_id}` | View customer record by ID (foreign ID returns 404, not 403) |

---

## 5. Catalog - Products & Variants (`/api/products`)

Allowed Roles: Admin (Read/Write), Staff (Read-Only).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products?page=1&page_size=25&type=software&search=...` | List products with variants |
| `POST` | `/api/products` | Create product (Admin only) |
| `GET` | `/api/products/{id}` | Get product details with variants |
| `PUT` | `/api/products/{id}` | Update product (Admin only) |
| `DELETE` | `/api/products/{id}` | Soft delete product (Admin only) |
| `POST` | `/api/products/{id}/variants` | Add variant (`attribute`, `value`, `extra_price`) (Admin only) |
| `PUT` | `/api/products/{id}/variants/{variant_id}` | Update variant extra price (Admin only) |
| `DELETE` | `/api/products/{id}/variants/{variant_id}` | Remove variant (Admin only) |

---

## 6. Catalog - Subscription Plans (`/api/plans`)

Allowed Roles: Admin (Read/Write), Staff (Read-Only).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/plans?billing_period=monthly` | List plans |
| `POST` | `/api/plans` | Create plan (`name`, `price`, `billing_period`, `min_quantity`, `available_from`, `available_to`, `auto_close`, `closable`, `pausable`, `renewable`) |
| `GET` | `/api/plans/{id}` | Get plan details |
| `PUT` | `/api/plans/{id}` | Update plan |
| `DELETE` | `/api/plans/{id}` | Soft delete plan |

---

## 7. Catalog - Tax Rules (`/api/taxes`)

Allowed Roles: Admin (Read/Write), Staff (Read-Only).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/taxes` | List tax rules |
| `POST` | `/api/taxes` | Create tax rule (`name`, `rate` in basis points, `scope`: all/product_type/product, `scope_value`) |
| `GET` | `/api/taxes/{id}` | Get tax rule details |
| `PUT` | `/api/taxes/{id}` | Update tax rule |
| `DELETE` | `/api/taxes/{id}` | Soft delete tax rule |
| `GET` | `/api/taxes/resolve/{product_id}` | Resolve effective tax rate for product (product > product_type > all) |

---

## 8. Catalog - Discount Rules (`/api/discounts`)

Allowed Roles: Admin (Read/Write), Staff (Read-Only).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/discounts?status_filter=active` | List discounts with computed status (`active`, `scheduled`, `expired`, `exhausted`) |
| `POST` | `/api/discounts` | Create discount rule (`name`, `type`, `value`, dates, limits, `applies_to`, `product_ids`) |
| `GET` | `/api/discounts/{id}` | Get discount rule details |
| `PUT` | `/api/discounts/{id}` | Update discount rule |
| `DELETE` | `/api/discounts/{id}` | Deactivate discount rule |

---

## 9. Catalog - Quotation Templates (`/api/quotation-templates`)

Allowed Roles: Admin and Staff (Full Management).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/quotation-templates` | List quotation templates with lines |
| `POST` | `/api/quotation-templates` | Create quotation template with product/variant lines |
| `GET` | `/api/quotation-templates/{id}` | Get quotation template details |
| `PUT` | `/api/quotation-templates/{id}` | Update quotation template and lines |
| `DELETE` | `/api/quotation-templates/{id}` | Soft delete quotation template |

---

## 10. Subscriptions (`/api/subscriptions`)

### Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/subscriptions` | Admin, Staff, Customer | List subscriptions. Filters: `status`, `customer_id`, `plan_id`, `is_paused`, `expiring_within_days`, `q` (search number or customer name), sorting, pagination. Customers only see their own non-draft subscriptions. |
| `GET` | `/api/subscriptions/board` | Admin, Staff, Customer | Kanban board summary: returns `{ [status]: { total: int, cards: [...] } }` for all 6 statuses, top 20 most recent per status. |
| `POST` | `/api/subscriptions` | Admin, Staff | Create a subscription with custom lines (`BL-00001` sequence counter). |
| `POST` | `/api/subscriptions/create-from-template` | Admin, Staff | Create subscription from quotation template (`template_id`, `customer_id`, `start_date`, `notes`). |
| `GET` | `/api/subscriptions/{id}` | Admin, Staff, Customer | Detail view with header, lines, linked customer, plan, and `subscription_events` history. Customers get 404 for draft or unowned. |
| `PUT` | `/api/subscriptions/{id}` | Admin, Staff | Update header and lines. Allowed only when status is `draft` or `quotation`; returns 409 if locked. |
| `POST` | `/api/subscriptions/{id}/status` | Admin, Staff, Customer | Execute state transition (`draft` -> `quotation`, `quotation` -> `confirmed`, `confirmed` -> `active`, `active`/any -> `closed`, etc.). 409 on illegal move. Customer allowed on confirm and close (if closable). |
| `POST` | `/api/subscriptions/{id}/pause` | Admin, Staff, Customer | Pause active subscription. Enforces `plan.pausable`. |
| `POST` | `/api/subscriptions/{id}/resume` | Admin, Staff, Customer | Resume paused subscription. If `next_billing_date` < today, resets to today. |
| `POST` | `/api/subscriptions/{id}/renew` | Admin, Staff, Customer | Renew active subscription extending `expiry_date` by `periods` (1..36, default 1). Enforces `plan.renewable`. |
| `POST` | `/api/subscriptions/{id}/addon-lines` | Admin, Staff | Add a new `add_on` product line to an Active subscription. Contract otherwise locked. |
| `PATCH` | `/api/subscriptions/{id}/lines/{line_id}/toggle` | Admin, Staff, Customer | Enable/disable an `add_on` line on an Active subscription. Takes effect on next invoice. |
| `POST` | `/api/subscriptions/{id}/invoice-preview` | Admin, Staff, Customer | Pure pricing preview calculation for date `as_of_date` without persisting to database. |

---

## 11. Advance Billing Engine (`/api/billing`)

### `POST /api/billing/run`
- **Allowed Roles**: Admin
- **Status**: 200 OK
- **Query Parameters**:
  - `dry_run`: boolean (default `false`)
  - `as_of_date`: calendar date YYYY-MM-DD (default today)
- **Request Body (optional)**:
  ```json
  {
    "subscription_ids": [1, 2, 3]
  }
  ```
- **Response Body**:
  ```json
  {
    "dry_run": false,
    "as_of_date": "2026-10-31",
    "subscriptions_evaluated": 15,
    "periods_due": 4,
    "invoices_created": 4,
    "already_billed_periods": 2,
    "total_invoiced_amount": 345000,
    "invoice_numbers": ["INV-2026-00001", "INV-2026-00002"],
    "errors": []
  }
  ```

---

## 12. Invoices & Billing Operations (`/api/invoices`)

### Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/invoices` | Admin, Staff, Customer | List invoices with pagination, sorting, filters (`status`, `customer_id`, `subscription_id`, `is_overdue`). Customers only see own non-draft. Computed fields include `is_overdue`, `days_overdue`. |
| `GET` | `/api/invoices/{id}` | Admin, Staff, Customer | Invoice detail with item lines, tax snapshots, customer address, and applied discount breakdown. Customers get 404 for draft or unowned. |
| `POST` | `/api/invoices/{id}/confirm` | Admin, Staff | Confirm draft invoice to posted status (`status='posted'`). |
| `POST` | `/api/invoices/{id}/cancel` | Admin, Staff | Cancel unpaid invoice. Atomically releases any claimed discount usage counter. |
| `POST` | `/api/invoices/{id}/send` | Admin, Staff | Send HTML invoice email to customer billing contact. Includes payment reminder banner if overdue. |
| `GET` | `/api/invoices/{id}/print` | Admin, Staff, Customer | Print-ready JSON payload with company profile, customer billing info, tax breakdown, and terms. |
| `POST` | `/api/invoices/bulk-action` | Admin, Staff | Execute bulk action (`confirm`, `send`, `cancel`) on array of up to 500 invoice IDs. |

---

## 13. System Maintenance (`/api/system`)

### `POST /api/system/run-daily`
- **Allowed Roles**: Admin
- **Status**: 200 OK
- **Request Body (optional)**:
  ```json
  {
    "as_of_date": "2026-10-31"
  }
  ```
- **Description**: Triggers APScheduler daily maintenance routine on demand:
  1. Activates `confirmed` subscriptions where `start_date <= today`.
  2. Closes expired `active` subscriptions where `expiry_date < today` and `plan.auto_close == true`.
  3. Executes daily advance billing run.
  Idempotent.
- **Response Body**:
  ```json
  {
    "as_of_date": "2026-10-31",
    "activated_count": 2,
    "auto_closed_count": 1,
    "billing_summary": {
      "subscriptions_evaluated": 12,
      "periods_due": 3,
      "invoices_created": 3,
      "already_billed_periods": 0,
      "total_invoiced_amount": 180000,
      "invoice_numbers": ["INV-2026-00003"],
      "errors": []
    }
  }
  ```
