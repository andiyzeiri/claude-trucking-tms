from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime


class CompanyRegistration(BaseModel):
    """Schema for company registration"""
    # Company details
    company_name: str = Field(..., min_length=2, max_length=200)
    mc_number: Optional[str] = Field(None, max_length=50)
    dot_number: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    company_email: Optional[str] = None

    # Admin user details
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (can include _ and -)')
        return v

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class CompanyRegistrationResponse(BaseModel):
    """Response after company registration"""
    message: str
    company_id: int
    user_id: int
    email: str
    username: str


class EmailVerification(BaseModel):
    """Schema for email verification"""
    token: str


class EmailVerificationResponse(BaseModel):
    """Response after email verification"""
    message: str
    email_verified: bool


class UserCreate(BaseModel):
    """Schema for creating a new user (by admin)"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: str = Field(..., description="User role: dispatcher, driver, customer, viewer")
    send_invitation: bool = Field(True, description="Send invitation email with credentials")

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (can include _ and -)')
        return v

    @validator('role')
    def validate_role(cls, v):
        valid_roles = ['dispatcher', 'driver', 'customer', 'viewer']
        if v.lower() not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v.lower()


class UserCreateResponse(BaseModel):
    """Response after creating a user"""
    message: str
    user_id: int
    username: str
    email: str
    temporary_password: Optional[str] = None
    role: str


class LoginRequest(BaseModel):
    """Schema for login request"""
    username_or_email: str
    password: str


class UserResponse(BaseModel):
    """User response schema"""
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    is_active: bool
    email_verified: bool
    email_verified_at: Optional[datetime]
    role: str
    company_id: int
    page_permissions: Optional[dict] = None
    allowed_pages: Optional[list[str]] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Response after successful login"""
    access_token: str
    token_type: str
    user: UserResponse
