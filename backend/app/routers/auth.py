from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.errors import (
    AppException,
    BadRequestException,
    ConflictException,
    RateLimitException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    enforce_password_policy,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.models.customer import Customer
from app.models.user import PasswordResetToken, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserProfileResponse,
)
from app.services.email import send_password_reset_email
from app.services.throttle import check_login_throttle, clear_failed_logins, record_failed_login

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def build_user_profile(user: User) -> UserProfileResponse:
    customer_id = user.customer.id if user.customer else None
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        customer_id=customer_id,
        created_at=user.created_at,
    )


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer user and customer profile",
)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    # 1. Enforce password rules
    enforce_password_policy(payload.password)

    # 2. Normalize email
    normalized_email = payload.email.strip().lower()

    # 3. Check for existing user (case-insensitive across ALL users)
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise ConflictException(detail="Email is already registered", code="EMAIL_ALREADY_EXISTS")

    # 4. Create new user
    new_user = User(
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role="customer",
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # to obtain new_user.id

    # 5. Check if staff already created a customer record with that email
    existing_customer = db.query(Customer).filter(Customer.email == normalized_email).first()
    if existing_customer:
        if existing_customer.user_id is None:
            # Link to existing customer record
            existing_customer.user_id = new_user.id
            existing_customer.name = payload.full_name.strip()
            existing_customer.company_name = payload.company_name.strip()
        else:
            raise ConflictException(
                detail="A customer account is already linked to this email",
                code="CUSTOMER_ALREADY_LINKED",
            )
    else:
        # Create new customer record
        new_customer = Customer(
            name=payload.full_name.strip(),
            company_name=payload.company_name.strip(),
            email=normalized_email,
            user_id=new_user.id,
            is_active=True,
        )
        db.add(new_customer)

    db.commit()
    db.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=build_user_profile(new_user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain an 8-hour access token (throttled)",
)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()

    # 1. Check throttle: 5 failed attempts per 15 mins -> 429
    check_login_throttle(normalized_email, db)

    # 2. Find user
    user = db.query(User).filter(User.email == normalized_email).first()
    ip_addr = request.client.host if request.client else None

    if not user or not verify_password(payload.password, user.hashed_password):
        record_failed_login(normalized_email, db, ip_address=ip_addr)
        raise UnauthorizedException(detail="Invalid email or password", code="INVALID_CREDENTIALS")

    if not user.is_active:
        raise UnauthorizedException(detail="Account has been deactivated", code="ACCOUNT_DEACTIVATED")

    # 3. Successful login: clear failed attempts
    clear_failed_logins(normalized_email, db)

    # 4. Generate token
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=build_user_profile(user),
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Retrieve current authenticated user profile",
)
def me(current_user: User = Depends(get_current_user)):
    return build_user_profile(current_user)


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change password for the current authenticated user",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise BadRequestException(detail="Current password is incorrect", code="INVALID_CURRENT_PASSWORD")

    enforce_password_policy(payload.new_password)

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return MessageResponse(detail="Password changed successfully")


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a single-use 30-minute password reset link",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email, User.is_active == True).first()

    if user:
        raw_token = generate_reset_token()
        token_hash = hash_reset_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES)

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_used=False,
        )
        db.add(reset_record)
        db.commit()

        send_password_reset_email(user.email, raw_token, background_tasks=background_tasks)

    # Always return generic 200 message to avoid account enumeration
    return MessageResponse(detail="If that email is registered, a password reset link has been sent.")


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using a valid single-use token",
)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = hash_reset_token(payload.token.strip())
    now = datetime.now(timezone.utc)

    reset_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.is_used == False,
            PasswordResetToken.expires_at > now,
        )
        .first()
    )

    if not reset_record:
        raise BadRequestException(
            detail="Password reset token is invalid or has expired",
            code="INVALID_RESET_TOKEN",
        )

    # Enforce password policy
    enforce_password_policy(payload.new_password)

    user = reset_record.user
    user.hashed_password = hash_password(payload.new_password)

    # Invalidate all outstanding tokens for this user
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).update({"is_used": True})

    db.commit()
    return MessageResponse(detail="Password has been reset successfully. You may now log in.")
