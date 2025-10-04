from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import get_current_active_user, get_password_hash
from app.models.user import User, UserRole
from app.schemas.auth import UserCreate, UserCreateResponse, UserResponse
from app.services.email import email_service
import secrets
import string

router = APIRouter()


def build_user_response(user: User) -> UserResponse:
    """Helper to build UserResponse with all fields"""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        is_active=user.is_active,
        email_verified=user.email_verified,
        email_verified_at=user.email_verified_at,
        role=user.role.value,
        company_id=user.company_id,
        page_permissions=user.page_permissions,
        allowed_pages=user.allowed_pages
    )


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    # Ensure it meets requirements
    if (any(c.isupper() for c in password) and
        any(c.islower() for c in password) and
        any(c.isdigit() for c in password)):
        return password
    # Regenerate if doesn't meet requirements
    return generate_temporary_password(length)


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user info"""
    return build_user_response(current_user)


@router.post("/", response_model=UserCreateResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user (admin only)"""

    # Check if current user is admin
    if current_user.role not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create users"
        )

    # Check if username already exists
    query = select(User).where(User.username == user_data.username)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Check if email already exists
    query = select(User).where(User.email == user_data.email)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )

    # Generate temporary password
    temporary_password = generate_temporary_password()

    # Map role string to UserRole enum
    role_mapping = {
        'dispatcher': UserRole.DISPATCHER,
        'driver': UserRole.DRIVER,
        'customer': UserRole.CUSTOMER,
        'viewer': UserRole.VIEWER
    }
    user_role = role_mapping.get(user_data.role.lower(), UserRole.VIEWER)

    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(temporary_password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_role,
        company_id=current_user.company_id,  # Same company as admin
        is_active=True,
        email_verified=True,  # Auto-verified when added by admin
        email_verified_at=None
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Send invitation email with credentials if requested
    if user_data.send_invitation:
        await email_service.send_user_invitation_email(
            to_email=new_user.email,
            invited_by=current_user.full_name,
            company_name=current_user.company.name,
            temporary_password=temporary_password,
            username=new_user.username
        )

    return UserCreateResponse(
        message="User created successfully" + (" and invitation email sent" if user_data.send_invitation else ""),
        user_id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        temporary_password=temporary_password if not user_data.send_invitation else None,
        role=new_user.role.value
    )


@router.get("/company-users")
async def get_company_users(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all users in the current user's company"""

    # Check permissions
    if current_user.role not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.DISPATCHER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view company users"
        )

    query = select(User).where(User.company_id == current_user.company_id)
    result = await db.execute(query)
    users = result.scalars().all()

    return [build_user_response(user) for user in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID (admin only, must be same company)"""

    # Check if current user is admin
    if current_user.role not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view user details"
        )

    query = select(User).where(
        User.id == user_id,
        User.company_id == current_user.company_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return build_user_response(user)


class UserUpdate(BaseModel):
    """Schema for updating user"""
    username: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    page_permissions: Optional[dict] = None


class UserUpdateResponse(BaseModel):
    """Response after updating user"""
    message: str
    user: UserResponse


@router.put("/{user_id}", response_model=UserUpdateResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user (admin only)"""

    # Check if current user is admin
    if current_user.role not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update users"
        )

    # Get user to update
    query = select(User).where(
        User.id == user_id,
        User.company_id == current_user.company_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admins from modifying their own admin status
    if user.id == current_user.id and user_data.role and user_data.role != user.role.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role"
        )

    # Check if username is being changed and already exists
    if user_data.username and user_data.username != user.username:
        query = select(User).where(User.username == user_data.username)
        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        user.username = user_data.username

    # Check if email is being changed and already exists
    if user_data.email and user_data.email != user.email:
        query = select(User).where(User.email == user_data.email)
        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        user.email = user_data.email

    # Update other fields
    if user_data.first_name:
        user.first_name = user_data.first_name
    if user_data.last_name:
        user.last_name = user_data.last_name
    if user_data.password:
        user.hashed_password = get_password_hash(user_data.password)
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    # Update role
    if user_data.role:
        role_mapping = {
            'company_admin': UserRole.COMPANY_ADMIN,
            'dispatcher': UserRole.DISPATCHER,
            'driver': UserRole.DRIVER,
            'customer': UserRole.CUSTOMER,
            'viewer': UserRole.VIEWER,
            'custom': UserRole.CUSTOM
        }
        if user_data.role.lower() in role_mapping:
            user.role = role_mapping[user_data.role.lower()]

    # Update page permissions (only for custom role)
    if user_data.page_permissions is not None:
        if user.role == UserRole.CUSTOM:
            user.page_permissions = user_data.page_permissions
        else:
            # If changing to custom role, set permissions
            if user_data.role and user_data.role.lower() == 'custom':
                user.page_permissions = user_data.page_permissions

    await db.commit()
    await db.refresh(user)

    return UserUpdateResponse(
        message="User updated successfully",
        user=build_user_response(user)
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete user (admin only)"""

    # Check if current user is admin
    if current_user.role not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete users"
        )

    # Prevent deleting yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )

    # Get user to delete
    query = select(User).where(
        User.id == user_id,
        User.company_id == current_user.company_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.delete(user)
    await db.commit()

    return {"message": "User deleted successfully"}


@router.put("/me")
async def update_current_user():
    return {"message": "Update current user - to be implemented"}