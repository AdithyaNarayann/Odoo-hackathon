import logging
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import check_password_rules, hash_password
from app.models.user import User

logger = logging.getLogger(__name__)


def bootstrap_admin(db: Session) -> None:
    """Bootstrap default admin account if none exists and env credentials are provided."""
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        return

    admin_exists = db.query(User).filter(User.role == "admin").first()
    if admin_exists:
        return

    admin_email = settings.ADMIN_EMAIL.strip().lower()
    # Check if a user with that email already exists
    existing_user = db.query(User).filter(User.email == admin_email).first()
    if existing_user:
        if existing_user.role != "admin":
            existing_user.role = "admin"
            db.commit()
            logger.info("Upgraded existing user %s to admin", admin_email)
        return

    # Check password rules
    failures = check_password_rules(settings.ADMIN_PASSWORD)
    if failures:
        logger.warning(
            "Bootstrap admin password does not satisfy security policy: %s. Proceeding anyway for bootstrap.",
            "; ".join(failures),
        )

    admin_user = User(
        email=admin_email,
        full_name="System Administrator",
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        role="admin",
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    logger.info("Admin user %s bootstrapped successfully", admin_email)
