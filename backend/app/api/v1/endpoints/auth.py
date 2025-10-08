from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import authenticate_user, create_access_token, get_password_hash
from app.config import settings
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.email_verification import EmailVerificationToken
from app.schemas.auth import (
    CompanyRegistration,
    CompanyRegistrationResponse,
    EmailVerification,
    EmailVerificationResponse,
    LoginRequest,
    LoginResponse,
    UserResponse
)
from app.services.email import email_service
import secrets

router = APIRouter()


@router.post("/register", response_model=CompanyRegistrationResponse)
async def register_company(
    registration: CompanyRegistration,
    db: AsyncSession = Depends(get_db)
):
    """Register a new company with an admin user"""

    # Check if username already exists
    query = select(User).where(User.username == registration.username)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email already exists
    query = select(User).where(User.email == registration.email)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if MC number already exists (if provided)
    if registration.mc_number:
        query = select(Company).where(Company.mc_number == registration.mc_number)
        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MC number already registered"
            )

    # Check if DOT number already exists (if provided)
    if registration.dot_number:
        query = select(Company).where(Company.dot_number == registration.dot_number)
        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DOT number already registered"
            )

    # Create company
    company = Company(
        name=registration.company_name,
        mc_number=registration.mc_number,
        dot_number=registration.dot_number,
        address=registration.address,
        city=registration.city,
        state=registration.state,
        zip_code=registration.zip_code,
        phone=registration.phone,
        email=registration.company_email
    )
    db.add(company)
    await db.flush()  # Flush to get company ID

    # Create admin user
    user = User(
        username=registration.username,
        email=registration.email,
        hashed_password=get_password_hash(registration.password),
        first_name=registration.first_name,
        last_name=registration.last_name,
        role=UserRole.COMPANY_ADMIN.value,
        company_id=company.id,
        is_active=True,
        email_verified=not settings.REQUIRE_EMAIL_VERIFICATION  # Auto-verify if not required
    )
    db.add(user)
    await db.flush()  # Flush to get user ID

    # Create email verification token
    verification_token = EmailVerificationToken(
        user_id=user.id,
        token=EmailVerificationToken.generate_token(),
        expires_at=EmailVerificationToken.create_expiration(hours=24)
    )
    db.add(verification_token)
    await db.commit()

    # Send verification email
    await email_service.send_verification_email(
        to_email=user.email,
        username=user.username,
        verification_token=verification_token.token
    )

    return CompanyRegistrationResponse(
        message="Company registered successfully. Please check your email to verify your account.",
        company_id=company.id,
        user_id=user.id,
        email=user.email,
        username=user.username
    )


@router.post("/verify-email", response_model=EmailVerificationResponse)
async def verify_email(
    verification: EmailVerification,
    db: AsyncSession = Depends(get_db)
):
    """Verify user email with token"""

    # Find verification token
    query = select(EmailVerificationToken).where(
        EmailVerificationToken.token == verification.token
    )
    result = await db.execute(query)
    token = result.scalar_one_or_none()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )

    if not token.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired or already been used"
        )

    # Get user
    query = select(User).where(User.id == token.user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Mark email as verified
    user.email_verified = True
    user.email_verified_at = datetime.utcnow()

    # Mark token as used
    token.used = True
    token.used_at = datetime.utcnow()

    await db.commit()

    # Send welcome email
    await email_service.send_welcome_email(
        to_email=user.email,
        username=user.username,
        company_name=user.company.name
    )

    return EmailVerificationResponse(
        message="Email verified successfully. You can now log in to your account.",
        email_verified=True
    )


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login with username or email"""
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if settings.REQUIRE_EMAIL_VERIFICATION and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login-json", response_model=LoginResponse)
async def login_json(
    login_request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with JSON body (username or email)"""
    user = await authenticate_user(db, login_request.username_or_email, login_request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    if settings.REQUIRE_EMAIL_VERIFICATION and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # Build user response with permissions
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        is_active=user.is_active,
        email_verified=user.email_verified,
        email_verified_at=user.email_verified_at,
        role=user.role if isinstance(user.role, str) else user.role.value,
        company_id=user.company_id,
        page_permissions=user.page_permissions,
        allowed_pages=user.allowed_pages if hasattr(user, 'allowed_pages') else []
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.post("/resend-verification")
async def resend_verification_email(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    """Resend verification email"""

    # Find user
    query = select(User).where(User.email == email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a verification link has been sent"}

    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )

    # Create new verification token
    verification_token = EmailVerificationToken(
        user_id=user.id,
        token=EmailVerificationToken.generate_token(),
        expires_at=EmailVerificationToken.create_expiration(hours=24)
    )
    db.add(verification_token)
    await db.commit()

    # Send verification email
    await email_service.send_verification_email(
        to_email=user.email,
        username=user.username,
        verification_token=verification_token.token
    )

    return {"message": "If the email exists, a verification link has been sent"}


@router.post("/refresh")
async def refresh_token():
    # TODO: Implement refresh token logic
    return {"message": "Refresh token endpoint - to be implemented"}