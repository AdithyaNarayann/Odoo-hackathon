# Brightloop Subscription Management System - API Specification

All responses adhere to standard conventions:
- List response shape: `{ "items": [...], "total": int, "page": int, "page_size": int }`
- Error response shape: `{ "detail": str, "code": str, "fields": [...] }`
- Money values are represented in integer paise (1 INR = 100 paise).
- Dates: calendar dates in `Asia/Kolkata`. Timestamps in UTC ISO-8601.

---

## 1. Authentication & Identity (`/api/auth`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Register customer user + customer record (auto-links if email pre-exists) |
| `POST` | `/api/auth/login` | Public | Login with email and password, throttled (5 attempts / 15 mins) |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile and linked customer info |
| `POST` | `/api/auth/change-password` | Authenticated | Change password adhering to validation policy |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset email (generic 200, no account enumeration) |
| `POST` | `/api/auth/reset-password` | Public | Reset password with single-use 30m token |

---

## 2. System Configuration (`/api/config`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/config/company` | Authenticated (`admin`, `staff`, `customer`) | Retrieve company details for invoicing |

---

## 3. Staff Management (`/api/staff`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/staff` | `admin` | List staff members with pagination & search |
| `POST` | `/api/staff` | `admin` | Create a new staff account |
| `GET` | `/api/staff/{id}` | `admin` | Get staff details |
| `PUT` | `/api/staff/{id}` | `admin` | Update staff details / active status |
| `DELETE` | `/api/staff/{id}` | `admin` | Deactivate staff member |

---

## 4. Customers (`/api/customers`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/customers` | `admin`, `staff` | List customers with search and pagination |
| `POST` | `/api/customers` | `admin`, `staff` | Create a new customer |
| `GET` | `/api/customers/{id}` | `admin`, `staff` | Get customer details |
| `PUT` | `/api/customers/{id}` | `admin`, `staff` | Update customer details |
| `DELETE` | `/api/customers/{id}` | `admin`, `staff` | Soft delete (is_active=False) customer |
| `GET` | `/api/portal/me` | `customer` | Get own customer profile & billing info |
| `PUT` | `/api/portal/me` | `customer` | Update own customer contact & billing info |

---

## 5. Catalog - Products & Variants (`/api/products`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/products` | `admin`, `staff` | List products with pagination, search, filters |
| `POST` | `/api/products` | `admin` | Create product |
| `GET` | `/api/products/{id}` | `admin`, `staff` | Get product with variants |
| `PUT` | `/api/products/{id}` | `admin` | Update product |
| `DELETE` | `/api/products/{id}` | `admin` | Soft delete product |
| `POST` | `/api/products/{id}/variants` | `admin` | Add product variant |
| `PUT` | `/api/products/{id}/variants/{variant_id}` | `admin` | Update variant extra price |
| `DELETE` | `/api/products/{id}/variants/{variant_id}` | `admin` | Remove variant |

---

## 6. Catalog - Plans (`/api/plans`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/plans` | `admin`, `staff` | List plans |
| `POST` | `/api/plans` | `admin` | Create plan |
| `GET` | `/api/plans/{id}` | `admin`, `staff` | Get plan details |
| `PUT` | `/api/plans/{id}` | `admin` | Update plan |
| `DELETE` | `/api/plans/{id}` | `admin` | Soft delete plan |

---

## 7. Catalog - Tax Rules (`/api/taxes`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/taxes` | `admin`, `staff` | List tax rules |
| `POST` | `/api/taxes` | `admin` | Create tax rule |
| `GET` | `/api/taxes/{id}` | `admin`, `staff` | Get tax rule |
| `PUT` | `/api/taxes/{id}` | `admin` | Update tax rule |
| `DELETE` | `/api/taxes/{id}` | `admin` | Soft delete tax rule |

---

## 8. Catalog - Discounts (`/api/discounts`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/discounts` | `admin`, `staff` | List discount rules with computed status |
| `POST` | `/api/discounts` | `admin` | Create discount rule |
| `GET` | `/api/discounts/{id}` | `admin`, `staff` | Get discount rule |
| `PUT` | `/api/discounts/{id}` | `admin` | Update discount rule |
| `DELETE` | `/api/discounts/{id}` | `admin` | Delete / deactivate discount rule |

---

## 9. Catalog - Quotation Templates (`/api/quotation-templates`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/quotation-templates` | `admin`, `staff` | List quotation templates |
| `POST` | `/api/quotation-templates` | `admin`, `staff` | Create quotation template with lines |
| `GET` | `/api/quotation-templates/{id}` | `admin`, `staff` | Get quotation template |
| `PUT` | `/api/quotation-templates/{id}` | `admin`, `staff` | Update quotation template |
| `DELETE` | `/api/quotation-templates/{id}` | `admin`, `staff` | Delete quotation template |
