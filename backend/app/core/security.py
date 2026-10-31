import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import bcrypt
import jwt

from app.core.config import settings
from app.core.errors import UnauthorizedException, UnprocessableEntityException


def check_password_rules(password: str) -> List[str]:
    """
    Validates password according to requirements:
    - More than 8 characters (length >= 9)
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one special (non-alphanumeric) character
    Returns a list of failed rule descriptions.
    """
    failures = []
    if len(password) <= 8:
        failures.append("Password must be more than 8 characters long (at least 9 characters).")
    if not any(c.isupper() for c in password):
        failures.append("Password must contain at least one uppercase letter.")
    if not any(c.islower() for c in password):
        failures.append("Password must contain at least one lowercase letter.")
    if not any(not c.isalnum() for c in password):
        failures.append("Password must contain at least one special character.")
    return failures


def enforce_password_policy(password: str) -> None:
    """Raises UnprocessableEntityException (422) if password fails any rules."""
    failures = check_password_rules(password)
    if failures:
        field_errors = [{"field": "password", "message": rule, "type": "password_rule_violation"} for rule in failures]
        raise UnprocessableEntityException(
            detail="Password does not satisfy security policy.",
            code="WEAK_PASSWORD",
            fields=field_errors,
        )


def hash_password(password: str) -> str:
    """Hash password directly using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password directly using bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token valid for 8 hours by default."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode JWT access token."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise UnauthorizedException(detail="Token has expired", code="TOKEN_EXPIRED")
    except jwt.PyJWTError:
        raise UnauthorizedException(detail="Could not validate credentials", code="INVALID_TOKEN")


def generate_reset_token() -> str:
    """Generate secure raw token for password reset."""
    return secrets.token_urlsafe(32)


def hash_reset_token(raw_token: str) -> str:
    """Hash the reset token with SHA-256 for secure DB storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
