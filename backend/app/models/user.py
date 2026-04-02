from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Enum, DateTime, JSON
from sqlalchemy.orm import relationship
from .base import Base
import enum
from datetime import datetime


class UserRole(enum.Enum):
    SUPER_ADMIN = "super_admin"  # System administrator
    COMPANY_ADMIN = "company_admin"  # Company administrator
    DISPATCHER = "dispatcher"  # Can manage loads, drivers, trucks
    DRIVER = "driver"  # Can only view assigned loads
    CUSTOMER = "customer"  # Can only view their own loads
    VIEWER = "viewer"  # Read-only access
    CUSTOM = "custom"  # Custom permissions


class User(Base):
    __tablename__ = "users"

    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime, nullable=True)

    # Role-based access control
    role = Column(String, default="viewer", nullable=False)

    # Custom page permissions (for CUSTOM role)
    page_permissions = Column(JSON, nullable=True)

    # Multi-tenant support
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="users")

    # Link to driver profile (if user is a driver)
    driver_profile = relationship("Driver", back_populates="user", uselist=False)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def allowed_pages(self) -> list[str]:
        """Return list of pages user can access"""
        # First priority: use page_permissions if set (works for any role)
        # This allows admins to customize any user's page access
        if self.page_permissions and self.page_permissions.get("pages"):
            pages = self.page_permissions.get("pages", [])
            # Ensure brokerage is included if loads is present
            if "loads" in pages and "brokerage" not in pages:
                idx = pages.index("loads") + 1
                pages.insert(idx, "brokerage")
            return pages

        # Default pages based on role - must match frontend sidebar.tsx and permissions-modal.tsx
        all_pages = [
            "dashboard",
            "dispatch",
            "loads",
            "brokerage",
            "lanes",
            "trucks",
            "drivers",
            "customers",
            "shippers",
            "receivers",
            "expenses",
            "fuel",
            "ifta",
            "payroll",
            "invoices",
            "ratecons",
            "reports",
            "users",
            "settings"
        ]

        if self.is_superuser or self.role == UserRole.SUPER_ADMIN:
            return all_pages

        if self.role == UserRole.COMPANY_ADMIN:
            return all_pages

        if self.role == UserRole.DISPATCHER:
            return ["dashboard", "dispatch", "loads", "brokerage", "lanes", "trucks", "drivers", "customers", "shippers", "receivers", "expenses", "fuel", "ifta", "payroll", "invoices", "reports"]

        if self.role == UserRole.DRIVER:
            return ["dashboard", "loads"]

        if self.role == UserRole.CUSTOMER:
            return ["dashboard", "loads", "invoices"]

        if self.role == UserRole.VIEWER:
            return ["dashboard", "dispatch", "loads", "lanes", "trucks", "drivers", "customers", "fuel", "ifta", "invoices", "reports"]

        return ["dashboard"]

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