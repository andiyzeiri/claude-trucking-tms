from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date as date_type, datetime
from decimal import Decimal
from typing import Optional, List, Literal

AccountType = Literal["asset", "liability", "equity", "revenue", "expense"]
NormalBalance = Literal["debit", "credit"]
JournalStatus = Literal["draft", "posted", "void"]
JournalSource = Literal["manual", "invoice", "fuel", "expense", "payroll"]
MappingEvent = Literal["invoice", "fuel", "expense", "payroll"]


# --------------------------------------------------------------------------
# Chart of accounts
# --------------------------------------------------------------------------

class AccountBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    type: AccountType
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: bool = True


class AccountCreate(AccountBase):
    # Derived from type when omitted - assets/expenses are debit-normal,
    # everything else is credit-normal. Overridable for contra accounts
    # (e.g. Accumulated Depreciation, an asset with a credit balance).
    normal_balance: Optional[NormalBalance] = None


class AccountUpdate(BaseModel):
    # code is intentionally absent: renumbering an account that already
    # has postings against it would silently rewrite history.
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


class AccountResponse(AccountBase):
    id: int
    normal_balance: NormalBalance
    company_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        use_enum_values = True


class AccountBalanceResponse(BaseModel):
    """An account plus its computed balance, signed to its normal side."""
    id: int
    code: str
    name: str
    type: AccountType
    normal_balance: NormalBalance
    total_debit: Decimal
    total_credit: Decimal
    balance: Decimal

    class Config:
        from_attributes = True


# --------------------------------------------------------------------------
# Journal entries
# --------------------------------------------------------------------------

class JournalLineInput(BaseModel):
    account_id: int
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    memo: Optional[str] = None

    @field_validator("debit", "credit")
    @classmethod
    def non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("debit and credit must be non-negative; use the other column instead of a negative amount")
        return v

    @model_validator(mode="after")
    def exactly_one_side(self):
        has_debit = self.debit > 0
        has_credit = self.credit > 0
        if has_debit and has_credit:
            raise ValueError("a line may carry a debit or a credit, not both")
        if not has_debit and not has_credit:
            raise ValueError("a line must carry either a debit or a credit")
        return self


class JournalLineResponse(BaseModel):
    id: int
    account_id: int
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    line_number: int
    debit: Decimal
    credit: Decimal
    memo: Optional[str] = None

    class Config:
        from_attributes = True


class JournalEntryCreate(BaseModel):
    entry_date: date_type
    memo: Optional[str] = None
    lines: List[JournalLineInput] = Field(..., min_length=2)

    @model_validator(mode="after")
    def must_balance(self):
        total_debit = sum((l.debit for l in self.lines), Decimal("0"))
        total_credit = sum((l.credit for l in self.lines), Decimal("0"))
        if total_debit != total_credit:
            diff = total_debit - total_credit
            raise ValueError(
                f"entry does not balance: debits {total_debit} vs credits {total_credit} (out by {diff})"
            )
        if total_debit == 0:
            raise ValueError("entry total must be greater than zero")
        return self


class JournalEntryUpdate(BaseModel):
    entry_date: Optional[date_type] = None
    memo: Optional[str] = None
    lines: Optional[List[JournalLineInput]] = Field(None, min_length=2)

    @model_validator(mode="after")
    def must_balance_if_lines_given(self):
        if self.lines is None:
            return self
        total_debit = sum((l.debit for l in self.lines), Decimal("0"))
        total_credit = sum((l.credit for l in self.lines), Decimal("0"))
        if total_debit != total_credit:
            diff = total_debit - total_credit
            raise ValueError(
                f"entry does not balance: debits {total_debit} vs credits {total_credit} (out by {diff})"
            )
        if total_debit == 0:
            raise ValueError("entry total must be greater than zero")
        return self


class JournalEntryResponse(BaseModel):
    id: int
    entry_number: Optional[str] = None
    entry_date: date_type
    memo: Optional[str] = None
    status: JournalStatus
    source: JournalSource
    source_id: Optional[int] = None
    posted_at: Optional[datetime] = None
    posted_by_id: Optional[int] = None
    created_by_id: Optional[int] = None
    reverses_id: Optional[int] = None
    company_id: int
    lines: List[JournalLineResponse] = []
    total_debit: Decimal = Decimal("0")
    total_credit: Decimal = Decimal("0")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        use_enum_values = True


class VoidRequest(BaseModel):
    """Voiding posts a reversing entry; it never mutates the original."""
    memo: Optional[str] = None
    reversal_date: Optional[date_type] = None


# --------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------

class TrialBalanceRow(BaseModel):
    account_id: int
    code: str
    name: str
    type: AccountType
    normal_balance: NormalBalance
    debit: Decimal
    credit: Decimal


class TrialBalanceResponse(BaseModel):
    as_of: date_type
    rows: List[TrialBalanceRow]
    total_debit: Decimal
    total_credit: Decimal
    # Should always be true. If it isn't, something bypassed the posting
    # service and wrote unbalanced lines directly.
    is_balanced: bool


class LedgerLine(BaseModel):
    entry_id: int
    entry_number: Optional[str] = None
    entry_date: date_type
    memo: Optional[str] = None
    source: JournalSource
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


class LedgerResponse(BaseModel):
    account_id: int
    code: str
    name: str
    normal_balance: NormalBalance
    opening_balance: Decimal
    closing_balance: Decimal
    lines: List[LedgerLine]


class StatementLine(BaseModel):
    account_id: int
    code: str
    name: str
    amount: Decimal


class IncomeStatementResponse(BaseModel):
    start_date: date_type
    end_date: date_type
    revenue: List[StatementLine]
    expenses: List[StatementLine]
    total_revenue: Decimal
    total_expenses: Decimal
    net_income: Decimal


class BalanceSheetResponse(BaseModel):
    as_of: date_type
    assets: List[StatementLine]
    liabilities: List[StatementLine]
    equity: List[StatementLine]
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal
    # Retained earnings from revenue less expenses through as_of, which is
    # what makes the sheet balance without a period-close posting.
    retained_earnings: Decimal
    is_balanced: bool


# --------------------------------------------------------------------------
# Auto-post mappings
# --------------------------------------------------------------------------

class AccountingMappingBase(BaseModel):
    event_key: MappingEvent
    debit_account_id: int
    credit_account_id: int

    @model_validator(mode="after")
    def distinct_accounts(self):
        if self.debit_account_id == self.credit_account_id:
            raise ValueError("debit and credit accounts must differ")
        return self


class AccountingMappingCreate(AccountingMappingBase):
    pass


class AccountingMappingResponse(AccountingMappingBase):
    id: int
    company_id: int
    debit_account: Optional[AccountResponse] = None
    credit_account: Optional[AccountResponse] = None

    class Config:
        from_attributes = True
