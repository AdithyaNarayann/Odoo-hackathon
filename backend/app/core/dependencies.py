from typing import Callable, List
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import ForbiddenException, NotFoundException, UnauthorizedException
from app.core.security import decode_access_token
from app.models.customer import Customer
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency to retrieve the authenticated user from JWT token."""
    if not credentials or not credentials.credentials:
        raise UnauthorizedException(detail="Authentication credentials were not provided", code="UNAUTHORIZED")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException(detail="Invalid token payload", code="INVALID_TOKEN")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise UnauthorizedException(detail="User not found", code="USER_NOT_FOUND")

    if not user.is_active:
        raise UnauthorizedException(detail="User account is inactive", code="USER_INACTIVE")

    return user


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency factory that verifies current user has one of the required roles."""
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise ForbiddenException(
                detail=f"User role '{user.role}' is not authorized to perform this action",
                code="FORBIDDEN_ROLE",
            )
        return user

    return role_checker


def get_current_customer(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Customer:
    """Returns the Customer record linked to the current user. Returns 404 if not found."""
    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    if not customer:
        raise NotFoundException(detail="Customer record not found", code="CUSTOMER_NOT_FOUND")
    return customer
