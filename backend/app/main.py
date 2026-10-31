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
    staff,
    subscriptions,
    system,
    taxes,
)
from app.services.bootstrap import bootstrap_admin
from app.services.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up %s", settings.APP_NAME)
    # Admin bootstrap
    db = SessionLocal()
    try:
        bootstrap_admin(db)
    except Exception as exc:
        logger.error("Failed to bootstrap admin: %s", exc, exc_info=True)
    finally:
        db.close()

    # Start in-process scheduler if enabled
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
app.include_router(system.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
