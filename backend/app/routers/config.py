from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import CompanyConfigResponse

router = APIRouter(prefix="/api/config", tags=["Config"])


@router.get(
    "/company",
    response_model=CompanyConfigResponse,
    summary="Get company invoice details (authenticated users)",
)
def get_company_config(current_user: User = Depends(get_current_user)):
    return CompanyConfigResponse(
        company_name=settings.COMPANY_NAME,
        company_address=settings.COMPANY_ADDRESS,
        company_tax_id=settings.COMPANY_TAX_ID,
        company_email=settings.COMPANY_EMAIL,
        company_phone=settings.COMPANY_PHONE,
    )
