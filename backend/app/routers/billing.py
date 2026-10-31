from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.schemas.invoice import BillingRunRequest, BillingRunResponse
from app.services.billing import run_billing_engine

router = APIRouter(
    prefix="/api/billing",
    tags=["Billing Operations"],
    dependencies=[Depends(require_roles("admin", "staff"))],
)


@router.post("/run", response_model=BillingRunResponse, summary="Execute advance billing run (Admin and Staff)")
def execute_billing_run(
    payload: BillingRunRequest,
    db: Session = Depends(get_db),
):
    result = run_billing_engine(
        db=db,
        as_of_date=payload.as_of_date,
        subscription_ids=payload.subscription_ids,
        dry_run=payload.dry_run,
    )
    return BillingRunResponse.model_validate(result)
