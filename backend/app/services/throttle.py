from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.errors import RateLimitException
from app.models.user import LoginAttempt

MAX_ATTEMPTS = 5
WINDOW_MINUTES = 15


def check_login_throttle(email: str, db: Session) -> None:
    """Checks if email has exceeded failed login attempts within WINDOW_MINUTES."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)
    normalized_email = email.strip().lower()

    count = (
        db.query(LoginAttempt)
        .filter(LoginAttempt.email == normalized_email, LoginAttempt.attempted_at >= cutoff)
        .count()
    )

    if count >= MAX_ATTEMPTS:
        raise RateLimitException(
            detail=f"Too many failed login attempts. Please try again after {WINDOW_MINUTES} minutes.",
            code="TOO_MANY_FAILED_LOGINS",
        )


def record_failed_login(email: str, db: Session, ip_address: str | None = None) -> None:
    """Records a failed login attempt for the given email."""
    normalized_email = email.strip().lower()
    attempt = LoginAttempt(
        email=normalized_email,
        attempted_at=datetime.now(timezone.utc),
        ip_address=ip_address,
    )
    db.add(attempt)
    db.commit()


def clear_failed_logins(email: str, db: Session) -> None:
    """Clears failed login attempts for the given email upon successful login."""
    normalized_email = email.strip().lower()
    db.query(LoginAttempt).filter(LoginAttempt.email == normalized_email).delete()
    db.commit()
