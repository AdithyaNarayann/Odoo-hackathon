from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_customer, require_roles
from app.core.errors import NotFoundException
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerPortalUpdateRequest, CustomerResponse

router = APIRouter(
    prefix="/api/portal",
    tags=["Customer Portal"],
    dependencies=[Depends(require_roles("customer"))],
)


@router.get("/me", response_model=CustomerResponse, summary="Get own customer profile and billing details")
def get_portal_profile(
    current_customer: Customer = Depends(get_current_customer),
):
    return CustomerResponse.model_validate(current_customer)


@router.put("/me", response_model=CustomerResponse, summary="Update own customer profile and billing details")
def update_portal_profile(
    payload: CustomerPortalUpdateRequest,
    current_customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    if payload.name is not None:
        current_customer.name = payload.name.strip()
    if payload.company_name is not None:
        current_customer.company_name = payload.company_name.strip()
    if payload.phone is not None:
        current_customer.phone = payload.phone.strip() if payload.phone else None
    if payload.address_line1 is not None:
        current_customer.address_line1 = payload.address_line1.strip() if payload.address_line1 else None
    if payload.address_line2 is not None:
        current_customer.address_line2 = payload.address_line2.strip() if payload.address_line2 else None
    if payload.city is not None:
        current_customer.city = payload.city.strip() if payload.city else None
    if payload.state is not None:
        current_customer.state = payload.state.strip() if payload.state else None
    if payload.postal_code is not None:
        current_customer.postal_code = payload.postal_code.strip() if payload.postal_code else None
    if payload.country is not None:
        current_customer.country = payload.country.strip() if payload.country else None
    if payload.tax_id is not None:
        current_customer.tax_id = payload.tax_id.strip() if payload.tax_id else None

    db.commit()
    db.refresh(current_customer)
    return CustomerResponse.model_validate(current_customer)


@router.get("/customer/{customer_id}", response_model=CustomerResponse, summary="Get customer profile by ID (isolated)")
def get_customer_by_id(
    customer_id: int,
    current_customer: Customer = Depends(get_current_customer),
):
    # Customer isolation: accessing any other customer's record returns 404, never 403
    if current_customer.id != customer_id:
        raise NotFoundException(detail="Customer not found", code="CUSTOMER_NOT_FOUND")
    return CustomerResponse.model_validate(current_customer)
