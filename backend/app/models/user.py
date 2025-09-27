from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Enum
from sqlalchemy.orm import relationship
from .base import Base
import enum


class UserRole(enum.Enum):
    SUPER_ADMIN = "super_admin"  # System administrator
    COMPANY_ADMIN = "company_admin"  # Company administrator
    DISPATCHER = "dispatcher"  # Can manage loads, drivers, trucks
    DRIVER = "driver"  # Can only view assigned loads
    CUSTOMER = "customer"  # Can only view their own loads
    VIEWER = "viewer"  # Read-only access


class User(Base):
    __tablename__ = "users"

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # Role-based access control
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)

    # Multi-tenant support
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="users")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def permissions(self) -> dict:
        """Return user permissions based on role"""
        base_permissions = {
            "can_view_loads": False,
            "can_create_loads": False,
            "can_edit_loads": False,
            "can_delete_loads": False,
            "can_view_drivers": False,
            "can_manage_drivers": False,
            "can_view_trucks": False,
            "can_manage_trucks": False,
            "can_view_customers": False,
            "can_manage_customers": False,
            "can_view_invoices": False,
            "can_manage_invoices": False,
            "can_view_reports": False,
            "can_manage_users": False,
            "can_manage_company": False,
        }

        if self.is_superuser or self.role == UserRole.SUPER_ADMIN:
            return {k: True for k in base_permissions.keys()}

        if self.role == UserRole.COMPANY_ADMIN:
            return {
                **base_permissions,
                "can_view_loads": True,
                "can_create_loads": True,
                "can_edit_loads": True,
                "can_delete_loads": True,
                "can_view_drivers": True,
                "can_manage_drivers": True,
                "can_view_trucks": True,
                "can_manage_trucks": True,
                "can_view_customers": True,
                "can_manage_customers": True,
                "can_view_invoices": True,
                "can_manage_invoices": True,
                "can_view_reports": True,
                "can_manage_users": True,
                "can_manage_company": True,
            }

        if self.role == UserRole.DISPATCHER:
            return {
                **base_permissions,
                "can_view_loads": True,
                "can_create_loads": True,
                "can_edit_loads": True,
                "can_view_drivers": True,
                "can_manage_drivers": True,
                "can_view_trucks": True,
                "can_manage_trucks": True,
                "can_view_customers": True,
                "can_view_invoices": True,
                "can_view_reports": True,
            }

        if self.role == UserRole.DRIVER:
            return {
                **base_permissions,
                "can_view_loads": True,  # Only assigned loads
            }

        if self.role == UserRole.CUSTOMER:
            return {
                **base_permissions,
                "can_view_loads": True,  # Only their own loads
                "can_view_invoices": True,  # Only their own invoices
            }

        if self.role == UserRole.VIEWER:
            return {
                **base_permissions,
                "can_view_loads": True,
                "can_view_drivers": True,
                "can_view_trucks": True,
                "can_view_customers": True,
                "can_view_invoices": True,
                "can_view_reports": True,
            }

        return base_permissions