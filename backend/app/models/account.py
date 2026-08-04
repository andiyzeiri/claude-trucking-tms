from sqlalchemy import Column, String, Integer, ForeignKey, Text, Boolean, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base


# Account types drive statement placement:
#   asset/liability/equity -> balance sheet
#   revenue/expense        -> income statement
ACCOUNT_TYPES = ("asset", "liability", "equity", "revenue", "expense")

# Normal balance per type. Assets and expenses increase with debits;
# liabilities, equity, and revenue increase with credits.
NORMAL_BALANCE_BY_TYPE = {
    "asset": "debit",
    "expense": "debit",
    "liability": "credit",
    "equity": "credit",
    "revenue": "credit",
}

BALANCE_SHEET_TYPES = ("asset", "liability", "equity")
INCOME_STATEMENT_TYPES = ("revenue", "expense")


class Account(Base):
    """A single line in the company's chart of accounts."""

    __tablename__ = "accounts"

    # Human-facing account number, e.g. "1200" for Accounts Receivable.
    # Unique per company, not globally.
    code = Column(String(20), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)
    normal_balance = Column(String(6), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)

    # Self-referential hierarchy so accounts can roll up (e.g. 6100 Fuel
    # under 6000 Operating Expenses). Purely presentational - postings
    # always land on the leaf account.
    parent_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    parent = relationship("Account", remote_side="Account.id", backref="children")

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    __table_args__ = (
        CheckConstraint(
            "type IN ('asset','liability','equity','revenue','expense')",
            name="accounts_type_chk",
        ),
        CheckConstraint(
            "normal_balance IN ('debit','credit')",
            name="accounts_normal_balance_chk",
        ),
        UniqueConstraint("company_id", "code", name="accounts_company_code_uniq"),
    )
