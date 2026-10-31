from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    company_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(...)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfileResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    customer_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # in seconds
    user: UserProfileResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class MessageResponse(BaseModel):
    detail: str


class CompanyConfigResponse(BaseModel):
    company_name: str
    company_address: str
    company_tax_id: str
    company_email: str
    company_phone: str
