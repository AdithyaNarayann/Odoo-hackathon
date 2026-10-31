from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.errors import ConflictException, NotFoundException
from app.core.security import enforce_password_policy, hash_password
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.user import StaffCreateRequest, StaffResponse, StaffUpdateRequest

router = APIRouter(
    prefix="/api/staff",
    tags=["Staff"],
    dependencies=[Depends(require_roles("admin"))],
)

WHITELISTED_SORT_COLUMNS = {
    "id": User.id,
    "email": User.email,
    "full_name": User.full_name,
    "is_active": User.is_active,
    "created_at": User.created_at,
}


@router.get("", response_model=PaginatedResponse[StaffResponse], summary="List staff members")
def list_staff(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.role == "staff")

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_filter),
                User.email.ilike(search_filter),
            )
        )

    sort_col = WHITELISTED_SORT_COLUMNS.get(sort_by, User.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse[StaffResponse](
        items=[StaffResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED, summary="Create staff member")
def create_staff(payload: StaffCreateRequest, db: Session = Depends(get_db)):
    enforce_password_policy(payload.password)

    normalized_email = payload.email.strip().lower()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise ConflictException(detail="Email is already registered", code="EMAIL_ALREADY_EXISTS")

    staff_user = User(
        email=normalized_email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role="staff",
        is_active=payload.is_active,
    )
    db.add(staff_user)
    db.commit()
    db.refresh(staff_user)
    return StaffResponse.model_validate(staff_user)


@router.get("/{id}", response_model=StaffResponse, summary="Get staff member details")
def get_staff(id: int, db: Session = Depends(get_db)):
    staff_user = db.query(User).filter(User.id == id, User.role == "staff").first()
    if not staff_user:
        raise NotFoundException(detail="Staff member not found", code="STAFF_NOT_FOUND")
    return StaffResponse.model_validate(staff_user)


@router.put("/{id}", response_model=StaffResponse, summary="Update staff member details")
def update_staff(id: int, payload: StaffUpdateRequest, db: Session = Depends(get_db)):
    staff_user = db.query(User).filter(User.id == id, User.role == "staff").first()
    if not staff_user:
        raise NotFoundException(detail="Staff member not found", code="STAFF_NOT_FOUND")

    if payload.full_name is not None:
        staff_user.full_name = payload.full_name.strip()

    if payload.password is not None:
        enforce_password_policy(payload.password)
        staff_user.hashed_password = hash_password(payload.password)

    if payload.is_active is not None:
        staff_user.is_active = payload.is_active

    db.commit()
    db.refresh(staff_user)
    return StaffResponse.model_validate(staff_user)


@router.delete("/{id}", response_model=StaffResponse, summary="Soft delete staff member")
def delete_staff(id: int, db: Session = Depends(get_db)):
    staff_user = db.query(User).filter(User.id == id, User.role == "staff").first()
    if not staff_user:
        raise NotFoundException(detail="Staff member not found", code="STAFF_NOT_FOUND")

    staff_user.is_active = False
    db.commit()
    db.refresh(staff_user)
    return StaffResponse.model_validate(staff_user)
