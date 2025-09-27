"""
Security middleware for multi-tenant data isolation and role-based access control
"""
from typing import Optional, List, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ..models.user import User, UserRole
from ..models.load import Load
from ..models.driver import Driver
from ..models.truck import Truck
from ..models.customer import Customer
from ..models.invoice import Invoice


class SecurityContext:
    """Security context for request-scoped security checks"""

    def __init__(self, user: User):
        self.user = user
        self.company_id = user.company_id
        self.role = user.role
        self.permissions = user.permissions
        self.is_superuser = user.is_superuser

    def check_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        return self.permissions.get(permission, False)

    def require_permission(self, permission: str):
        """Require specific permission or raise HTTP 403"""
        if not self.check_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {permission}"
            )

    def can_access_company_data(self, company_id: int) -> bool:
        """Check if user can access data from specific company"""
        if self.is_superuser or self.role == UserRole.SUPER_ADMIN:
            return True
        return self.company_id == company_id

    def require_company_access(self, company_id: int):
        """Require access to specific company data or raise HTTP 403"""
        if not self.can_access_company_data(company_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to company data"
            )


class DataFilter:
    """Database query filters for multi-tenant data isolation"""

    def __init__(self, security_context: SecurityContext):
        self.ctx = security_context

    def filter_loads(self, query: Query) -> Query:
        """Filter loads based on user role and company"""
        if self.ctx.is_superuser or self.ctx.role == UserRole.SUPER_ADMIN:
            return query

        # Company-based filtering
        query = query.where(Load.company_id == self.ctx.company_id)

        # Role-based filtering
        if self.ctx.role == UserRole.DRIVER:
            # Drivers can only see their assigned loads
            query = query.where(Load.driver_id == self.ctx.user.id)
        elif self.ctx.role == UserRole.CUSTOMER:
            # Customers can only see loads they created
            query = query.where(Load.customer_id == self._get_customer_id())

        return query

    def filter_drivers(self, query: Query) -> Query:
        """Filter drivers based on user role and company"""
        if self.ctx.is_superuser or self.ctx.role == UserRole.SUPER_ADMIN:
            return query

        # Company-based filtering
        return query.where(Driver.company_id == self.ctx.company_id)

    def filter_trucks(self, query: Query) -> Query:
        """Filter trucks based on user role and company"""
        if self.ctx.is_superuser or self.ctx.role == UserRole.SUPER_ADMIN:
            return query

        # Company-based filtering
        return query.where(Truck.company_id == self.ctx.company_id)

    def filter_customers(self, query: Query) -> Query:
        """Filter customers based on user role and company"""
        if self.ctx.is_superuser or self.ctx.role == UserRole.SUPER_ADMIN:
            return query

        # Company-based filtering
        query = query.where(Customer.company_id == self.ctx.company_id)

        # Role-based filtering
        if self.ctx.role == UserRole.CUSTOMER:
            # Customers can only see themselves
            query = query.where(Customer.id == self._get_customer_id())

        return query

    def filter_invoices(self, query: Query) -> Query:
        """Filter invoices based on user role and company"""
        if self.ctx.is_superuser or self.ctx.role == UserRole.SUPER_ADMIN:
            return query

        # Company-based filtering via load relationship
        query = query.join(Load).where(Load.company_id == self.ctx.company_id)

        # Role-based filtering
        if self.ctx.role == UserRole.CUSTOMER:
            # Customers can only see invoices for their loads
            query = query.where(Load.customer_id == self._get_customer_id())

        return query

    def filter_users(self, query: Query) -> Query:
        """Filter users based on user role and company"""
        if self.ctx.is_superuser or self.ctx.role == UserRole.SUPER_ADMIN:
            return query

        # Company admins can see all users in their company
        if self.ctx.role == UserRole.COMPANY_ADMIN:
            return query.where(User.company_id == self.ctx.company_id)

        # Other roles can only see themselves
        return query.where(User.id == self.ctx.user.id)

    def _get_customer_id(self) -> Optional[int]:
        """Get customer ID for customer role users"""
        # This assumes there's a relationship between user and customer
        # You might need to adjust based on your data model
        if hasattr(self.ctx.user, 'customer'):
            return self.ctx.user.customer.id
        return None


def create_security_context(user: User) -> SecurityContext:
    """Factory function to create security context"""
    return SecurityContext(user)


def create_data_filter(security_context: SecurityContext) -> DataFilter:
    """Factory function to create data filter"""
    return DataFilter(security_context)


# Decorator for permission checking
def require_permissions(*permissions: str):
    """Decorator to require specific permissions for endpoint access"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract security context from kwargs or args
            security_context = kwargs.get('security_context')
            if not security_context:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Security context not found"
                )

            # Check all required permissions
            for permission in permissions:
                security_context.require_permission(permission)

            return await func(*args, **kwargs)
        return wrapper
    return decorator


# Common permission requirements
def require_load_view(security_context: SecurityContext):
    """Require permission to view loads"""
    security_context.require_permission("can_view_loads")

def require_load_create(security_context: SecurityContext):
    """Require permission to create loads"""
    security_context.require_permission("can_create_loads")

def require_load_edit(security_context: SecurityContext):
    """Require permission to edit loads"""
    security_context.require_permission("can_edit_loads")

def require_load_delete(security_context: SecurityContext):
    """Require permission to delete loads"""
    security_context.require_permission("can_delete_loads")

def require_user_management(security_context: SecurityContext):
    """Require permission to manage users"""
    security_context.require_permission("can_manage_users")

def require_company_admin(security_context: SecurityContext):
    """Require company admin role or higher"""
    if not (security_context.is_superuser or
            security_context.role in [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company admin access required"
        )