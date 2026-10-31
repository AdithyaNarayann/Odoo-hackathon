from sqlalchemy import text
from sqlalchemy.orm import Session


def test_explain_query_plan_uses_composite_indexes(db_session: Session):
    queries = [
        "EXPLAIN QUERY PLAN SELECT * FROM subscriptions WHERE status = 'active' AND plan_id = 1",
        "EXPLAIN QUERY PLAN SELECT * FROM subscriptions WHERE customer_id = 1",
        "EXPLAIN QUERY PLAN SELECT * FROM subscriptions WHERE next_billing_date <= '2026-10-31'",
        "EXPLAIN QUERY PLAN SELECT * FROM subscriptions WHERE expiry_date <= '2026-10-31'",
        "EXPLAIN QUERY PLAN SELECT * FROM invoices WHERE status = 'confirmed' AND due_date < '2026-10-31'",
        "EXPLAIN QUERY PLAN SELECT * FROM invoices WHERE customer_id = 1",
        "EXPLAIN QUERY PLAN SELECT * FROM payments WHERE payment_date >= '2026-10-01'",
        "EXPLAIN QUERY PLAN SELECT * FROM payments WHERE invoice_id = 1",
        "EXPLAIN QUERY PLAN SELECT * FROM payments WHERE method = 'card' AND payment_date >= '2026-10-01'",
    ]

    for q in queries:
        rows = db_session.execute(text(q)).fetchall()
        # In SQLite, rows[-1][-1] contains the query plan detail string
        plan_detail = rows[-1][-1].lower()
        # Ensure it uses an index, not a full table scan
        assert "using index" in plan_detail, f"Query '{q}' did not use an index: {plan_detail}"
