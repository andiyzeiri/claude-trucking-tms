from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, CheckConstraint, UniqueConstraint
from .base import Base


# Report types that can be emailed. Keyed rather than free-text so a typo
# cannot silently create a recipient list nobody ever sends to.
REPORT_KEYS = ("weekly_trips",)

REPORT_LABELS = {
    "weekly_trips": "Weekly Trips",
}


class ReportRecipient(Base):
    """
    An email address that receives a given report for a company.

    Recipients are per (company, report_key), so adding a second report type
    later - payroll, say - is a new key rather than a new table.
    """

    __tablename__ = "report_recipients"

    report_key = Column(String(40), nullable=False)
    email = Column(String(255), nullable=False)
    name = Column(String(255))
    is_active = Column(Boolean, nullable=False, default=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    __table_args__ = (
        CheckConstraint(
            "report_key IN ('weekly_trips')",
            name="rr_report_key_chk",
        ),
        UniqueConstraint(
            "company_id", "report_key", "email", name="rr_company_report_email_uniq"
        ),
    )
