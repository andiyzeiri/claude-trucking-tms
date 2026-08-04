from sqlalchemy import Column, String, Integer, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base


# Operational events that can auto-post to the ledger. Each maps to a
# debit account and a credit account.
MAPPING_EVENTS = ("invoice", "fuel", "expense", "payroll")

# What each event posts, in plain terms:
#   invoice -> debit Accounts Receivable, credit Revenue
#   fuel    -> debit Fuel Expense,        credit Cash or A/P
#   expense -> debit Operating Expense,   credit Cash or A/P
#   payroll -> debit Driver Wages,        credit Cash or Payroll Liability
EVENT_DESCRIPTIONS = {
    "invoice": ("Accounts Receivable", "Revenue"),
    "fuel": ("Fuel Expense", "Cash / Accounts Payable"),
    "expense": ("Operating Expense", "Cash / Accounts Payable"),
    "payroll": ("Driver Wages", "Cash / Payroll Liability"),
}


class AccountingMapping(Base):
    """
    Per-company wiring from an operational event to the two accounts it
    posts against.

    This exists because the chart of accounts starts empty - auto-posting
    has nowhere to post until the company defines its own accounts and
    points each event at them. An event with no mapping row is simply
    skipped (and logged), so freight operations continue normally while
    the chart is still being built out.
    """

    __tablename__ = "accounting_mappings"

    event_key = Column(String(20), nullable=False)

    debit_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    credit_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    debit_account = relationship("Account", foreign_keys=[debit_account_id])
    credit_account = relationship("Account", foreign_keys=[credit_account_id])

    __table_args__ = (
        CheckConstraint(
            "event_key IN ('invoice','fuel','expense','payroll')",
            name="am_event_key_chk",
        ),
        CheckConstraint(
            "debit_account_id <> credit_account_id",
            name="am_distinct_accounts_chk",
        ),
        UniqueConstraint("company_id", "event_key", name="am_company_event_uniq"),
    )
