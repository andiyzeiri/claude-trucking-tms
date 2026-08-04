from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.user import User
from .security_middleware import SecurityContext, DataFilter, create_security_context, create_data_filter

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def authenticate_user(db: AsyncSession, username_or_email: str, password: str) -> Union[User, bool]:
    """Authenticate user by username or email"""
    # Try to find user by username or email
    query = select(User).where(
        (User.username == username_or_email) | (User.email == username_or_email)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    if not user.is_active:
        return False
    return user


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    query = select(User).where(User.email == email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def _role_value(user: User) -> str:
    """
    Normalize the user's role to a plain lowercase string.

    users.role is a String column, but UserRole is a plain enum.Enum, so
    `user.role == UserRole.COMPANY_ADMIN` compares str to enum member and
    is always False. Comparing on .value avoids that trap.
    """
    role = getattr(user, "role", None)
    if role is None:
        return ""
    return str(getattr(role, "value", role)).lower()


ADMIN_ROLES = {"super_admin", "company_admin"}


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Guard for admin-only routes such as the general ledger.

    Financial records are restricted to company and super admins;
    dispatchers, drivers, customers, and viewers are refused.
    """
    if current_user.is_superuser or _role_value(current_user) in ADMIN_ROLES:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator access is required for accounting",
    )


async def get_security_context(
    current_user: User = Depends(get_current_active_user)
) -> SecurityContext:
    """Get security context for the current user"""
    return create_security_context(current_user)


async def get_data_filter(
    security_context: SecurityContext = Depends(get_security_context)
) -> DataFilter:
    """Get data filter for the current user's security context"""
    return create_data_filter(security_context)