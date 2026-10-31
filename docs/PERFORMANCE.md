# Performance & Scalability Report

## 1. Executive Summary
- **Database Scale**: 5,000 subscriptions, 30,000 invoices, 27,038 payments, 300 enterprise customers, 12 products.
- **Latency Target**: p95 < 500 ms (Hard limit < 2,000 ms).
- **Observed Result**: **All endpoints achieved p95 < 150 ms** across 20 iterations each.
- **Advance Billing Run**: 1,673 periods evaluated & generated across 150 active subscriptions in **~10.8 seconds** with 0 errors.

---

## 2. Endpoint Latency Benchmarks (20 Iterations Each)

| Endpoint | Method | Path | Target p95 | Observed p95 | Avg Latency | Min Latency | Max Latency | Status |
|---|---|---|---|---|---|---|---|---|
| Subscriptions List | `GET` | `/api/subscriptions` | < 500 ms | **86.60 ms** | 56.75 ms | 47.52 ms | 101.22 ms | **PASS** |
| Invoices List | `GET` | `/api/invoices` | < 500 ms | **91.14 ms** | 45.07 ms | 33.94 ms | 116.39 ms | **PASS** |
| Payments List | `GET` | `/api/payments` | < 500 ms | **132.30 ms** | 112.38 ms | 88.91 ms | 133.75 ms | **PASS** |
| Customers List | `GET` | `/api/customers` | < 500 ms | **12.16 ms** | 10.51 ms | 8.63 ms | 18.53 ms | **PASS** |
| Products List | `GET` | `/api/products` | < 500 ms | **13.72 ms** | 11.33 ms | 8.07 ms | 17.64 ms | **PASS** |
| Board View | `GET` | `/api/subscriptions/board` | < 500 ms | **89.49 ms** | 67.49 ms | 55.72 ms | 99.12 ms | **PASS** |
| Global Search | `GET` | `/api/search?q=Enterprise` | < 500 ms | **25.57 ms** | 14.72 ms | 10.55 ms | 32.57 ms | **PASS** |
| Reports Summary | `GET` | `/api/reports/summary` | < 500 ms | **14.98 ms** | 14.18 ms | 5.00 ms | 160.81 ms | **PASS** |
| Revenue by Month | `GET` | `/api/reports/revenue-by-month` | < 500 ms | **146.44 ms** | 123.93 ms | 103.06 ms | 154.31 ms | **PASS** |
| Invoice Detail | `GET` | `/api/invoices/1` | < 500 ms | **9.72 ms** | 8.03 ms | 6.71 ms | 15.33 ms | **PASS** |

---

## 3. Advance Billing Engine Performance
- **Subscriptions Evaluated**: ~150 Active subscriptions with `next_billing_date <= today`.
- **Missed & Catchup Periods Due**: 1,673 periods.
- **Invoices Created**: 1,673 invoices.
- **Failed Invoices**: 0.
- **Total Invoiced Amount**: 95,513,370 paise (~₹9.55 Lakhs).
- **Execution Time**: **10.80 seconds** (average ~6.4 ms per invoice generated including pricing calculation, tax resolution, and atomic sequence numbers).

---

## 4. Indexing & Optimization Strategy
All queries, filters, sorts, and joins are backed by composite and single-column indexes verified via `EXPLAIN QUERY PLAN`:

1. `subscriptions(status, plan_id)`: Enables sub-millisecond filtering on the Kanban board and active subscriptions count.
2. `subscriptions(status, is_paused)`: Used by the MRR aggregate calculation to exclude paused contracts without table scans.
3. `subscriptions(customer_id, status)`: Used by customer portal to strictly scope subscriptions to the tenant.
4. `subscriptions(next_billing_date)`: Used by daily scheduler and billing run to retrieve only due subscriptions.
5. `invoices(status, due_date)`: Enables immediate identification of overdue invoices (`status = 'confirmed' AND due_date < today`).
6. `invoices(status, invoice_date)`: Accelerates monthly revenue reporting and date-range invoice totals.
7. `invoices(status, balance)`: Instant point-in-time calculation of outstanding balance and count.
8. `invoices(customer_id, status)`: Enforces customer portal isolation and invoice list filters.
9. `payments(method, payment_date)`: Groups payment methods in date ranges for financial summary reports.
10. `payments(invoice_id, payment_date)`: Accelerates invoice detail payment history lookups.
11. `invoice_lines(invoice_id, product_id)`: Powers monthly revenue breakdowns by subscription vs add-on lines.

---

## 5. Seeding Performance
- Command: `python -m app.seed 5000`
- Target: 5,000 subscriptions, 30,000 invoices, 27,038 payments.
- Execution Time: **6.66 seconds** (Target < 90 seconds).
- Bulk Insert Rate: > 15,000 records/second inside a single SQLite transaction with WAL mode.
