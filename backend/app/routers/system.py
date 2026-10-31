from datetime import date
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.services.scheduler import run_daily_maintenance

router = APIRouter(
    prefix="/api/system",
    tags=["System Operations"],
    dependencies=[Depends(require_roles("admin"))],
)


class RunDailyRequest(BaseModel):
    as_of_date: Optional[date] = None


@router.post("/run-daily", summary="Trigger daily maintenance task manually (Admin only)")
def trigger_daily_maintenance(
    payload: Optional[RunDailyRequest] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    as_of_date = payload.as_of_date if payload else None
    return run_daily_maintenance(db, as_of_date=as_of_date)
