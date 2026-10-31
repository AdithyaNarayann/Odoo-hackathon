from datetime import date
import time
from typing import Dict, List, Tuple
from fastapi.testclient import TestClient
import numpy as np

from app.core.database import SessionLocal
from app.main import app
from app.models.subscription import Subscription
from app.seed import run_seed


def ensure_database_seeded():
    db = SessionLocal()
    try:
        count = db.query(Subscription).count()
        if count < 5000:
            run_seed(size=5000, reset=True, db=db)
    finally:
        db.close()


def test_endpoint_latencies_p95_under_500ms():
    """
    Performance test: on the seeded data hit every list endpoint, the board,
    search, summary, revenue-by-month and invoice detail 20 times each
    and assert p95 under 500 ms (hard limit is 2 seconds).
    """
    app.dependency_overrides.clear()
    ensure_database_seeded()
    client = TestClient(app)

    # Login as admin
    res_login = client.post(
        "/api/auth/login",
        json={"email": "admin@brightloop.io", "password": "Admin@Brightloop2026"},
    )
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    endpoints: List[Tuple[str, str]] = [
        ("/api/subscriptions", "Subscriptions List"),
        ("/api/invoices", "Invoices List"),
        ("/api/payments", "Payments List"),
        ("/api/customers", "Customers List"),
        ("/api/products", "Products List"),
        ("/api/subscriptions/board", "Board View"),
        ("/api/search?q=Enterprise", "Global Search"),
        ("/api/reports/summary", "Reports Summary"),
        ("/api/reports/revenue-by-month", "Revenue by Month"),
        ("/api/invoices/1", "Invoice Detail"),
    ]

    metrics: Dict[str, Dict[str, float]] = {}

    for url, name in endpoints:
        durations: List[float] = []
        for _ in range(20):
            t0 = time.perf_counter()
            res = client.get(url, headers=headers)
            t1 = time.perf_counter()
            assert res.status_code == 200, f"{name} failed: {res.status_code} {res.text}"
            durations.append((t1 - t0) * 1000.0)

        p95 = float(np.percentile(durations, 95))
        avg = float(np.mean(durations))
        min_ms = float(np.min(durations))
        max_ms = float(np.max(durations))

        metrics[name] = {
            "avg": avg,
            "p95": p95,
            "min": min_ms,
            "max": max_ms,
        }

        # Assert p95 under 500 ms
        assert p95 < 500.0, f"Endpoint {name} ({url}) exceeded 500ms p95: {p95:.2f}ms"


def test_billing_run_performance():
    """Time a full advance billing run over due subscriptions."""
    app.dependency_overrides.clear()
    ensure_database_seeded()
    client = TestClient(app)

    res_login = client.post(
        "/api/auth/login",
        json={"email": "admin@brightloop.io", "password": "Admin@Brightloop2026"},
    )
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    t0 = time.perf_counter()
    res = client.post(
        "/api/billing/run",
        headers=headers,
        json={"as_of_date": str(date.today()), "dry_run": False},
    )
    t1 = time.perf_counter()

    assert res.status_code == 200
    data = res.json()
    assert len(data.get("failed", [])) == 0
    elapsed = t1 - t0
    # Billing run should execute within reasonable limits (under 60s for 150+ subscriptions)
    assert elapsed < 60.0
