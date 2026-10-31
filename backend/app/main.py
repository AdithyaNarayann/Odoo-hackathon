import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.errors import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.routers import (
    auth,
    billing,
    config,
    customers,
    discounts,
    invoices,
    payments,
    plans,
    portal,
    products,
    quotation_templates,
    reports,
    search,
    staff,
    subscriptions,
    system,
    taxes,
)
from app.services.bootstrap import ensure_default_accounts
from app.services.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up %s", settings.APP_NAME)

    # 1. Apply pending Alembic migrations in development
    if settings.APP_ENV != "production":
        try:
            import os
            from alembic import command
            from alembic.config import Config
            alembic_ini = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini"))
            if os.path.exists(alembic_ini):
                logger.info("Verifying and applying pending database migrations...")
                cfg = Config(alembic_ini)
                command.upgrade(cfg, "head")
        except Exception as exc:
            logger.error("Database migration check failed on startup: %s", exc, exc_info=True)

    # 2. Ensure default accounts & Demo Traders sample data
    if settings.SEED_DEFAULT_ACCOUNTS and settings.APP_ENV != "production":
        db = SessionLocal()
        try:
            ensure_default_accounts(db)
        except Exception as exc:
            logger.error("Failed to ensure default accounts: %s", exc, exc_info=True)
        finally:
            db.close()

    # 3. Start in-process scheduler if enabled
    start_scheduler()

    yield
    # Shutdown actions
    stop_scheduler()
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)

# Include Routers
app.include_router(auth.router)
app.include_router(config.router)
app.include_router(staff.router)
app.include_router(customers.router)
app.include_router(portal.router)
app.include_router(products.router)
app.include_router(plans.router)
app.include_router(taxes.router)
app.include_router(discounts.router)
app.include_router(quotation_templates.router)
app.include_router(subscriptions.router)
app.include_router(billing.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(reports.router)
app.include_router(search.router)
app.include_router(system.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
