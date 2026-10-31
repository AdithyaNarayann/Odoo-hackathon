from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import NotFoundException
from app.models.customer import Customer
from app.schemas.common import PaginatedResponse
from app.schemas.customer import CustomerCreateRequest, CustomerResponse, CustomerUpdateRequest

router = APIRouter(
    prefix="/api/customers",
    tags=["Customers"],
    dependencies=[Depends(require_roles("admin", "staff"))],
)

WHITELISTED_SORT_COLUMNS = {
    "id": Customer.id,
    "name": Customer.name,
    "company_name": Customer.company_name,
    "email": Customer.email,
    "city": Customer.city,
    "state": Customer.state,
    "is_active": Customer.is_active,
    "created_at": Customer.created_at,
}


@router.get("", response_model=PaginatedResponse[CustomerResponse], summary="List customers")
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    db: Session = Depends(get_db),
):
    query = db.query(Customer)

    if is_active is not None:
        query = query.filter(Customer.is_active == is_active)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(search_filter),
                Customer.company_name.ilike(search_filter),
                Customer.email.ilike(search_filter),
                Customer.city.ilike(search_filter),
            )
        )

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, Customer.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[CustomerResponse](
        items=[CustomerResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED, summary="Create a customer")
def create_customer(payload: CustomerCreateRequest, db: Session = Depends(get_db)):
    customer = Customer(
        name=payload.name.strip(),
        company_name=payload.company_name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip() if payload.phone else None,
        address_line1=payload.address_line1.strip() if payload.address_line1 else None,
        address_line2=payload.address_line2.strip() if payload.address_line2 else None,
        city=payload.city.strip() if payload.city else None,
        state=payload.state.strip() if payload.state else None,
        postal_code=payload.postal_code.strip() if payload.postal_code else None,
        country=payload.country.strip() if payload.country else None,
        tax_id=payload.tax_id.strip() if payload.tax_id else None,
        is_active=payload.is_active,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/{id}", response_model=CustomerResponse, summary="Get customer details")
def get_customer(id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise NotFoundException(detail="Customer not found", code="CUSTOMER_NOT_FOUND")
    return CustomerResponse.model_validate(customer)


@router.put("/{id}", response_model=CustomerResponse, summary="Update customer details")
def update_customer(id: int, payload: CustomerUpdateRequest, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise NotFoundException(detail="Customer not found", code="CUSTOMER_NOT_FOUND")

    if payload.name is not None:
        customer.name = payload.name.strip()
    if payload.company_name is not None:
        customer.company_name = payload.company_name.strip()
    if payload.email is not None:
        customer.email = payload.email.strip().lower()
    if payload.phone is not None:
        customer.phone = payload.phone.strip() if payload.phone else None
    if payload.address_line1 is not None:
        customer.address_line1 = payload.address_line1.strip() if payload.address_line1 else None
    if payload.address_line2 is not None:
        customer.address_line2 = payload.address_line2.strip() if payload.address_line2 else None
    if payload.city is not None:
        customer.city = payload.city.strip() if payload.city else None
    if payload.state is not None:
        customer.state = payload.state.strip() if payload.state else None
    if payload.postal_code is not None:
        customer.postal_code = payload.postal_code.strip() if payload.postal_code else None
    if payload.country is not None:
        customer.country = payload.country.strip() if payload.country else None
    if payload.tax_id is not None:
        customer.tax_id = payload.tax_id.strip() if payload.tax_id else None
    if payload.is_active is not None:
        customer.is_active = payload.is_active

    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{id}", response_model=CustomerResponse, summary="Soft delete customer")
def delete_customer(id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == id).first()
    if not customer:
        raise NotFoundException(detail="Customer not found", code="CUSTOMER_NOT_FOUND")

    customer.is_active = False
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)
