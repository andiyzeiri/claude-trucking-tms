"""
General ledger endpoints.

Every route here is admin-only and scoped to current_user.company_id.
Posted entries are never mutated - see app/services/accounting.py.
"""

import logging
from datetime import date as date_type
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.security import get_current_admin_user
from app.models.user import User
from app.models.account import (
    Account, NORMAL_BALANCE_BY_TYPE, BALANCE_SHEET_TYPES, INCOME_STATEMENT_TYPES,
)
from app.models.accounting_mapping import AccountingMapping
from app.models.journal_entry import JournalEntry, JournalLine
from app.schemas.accounting import (
    AccountCreate, AccountUpdate, AccountResponse,
    JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse, JournalLineResponse,
    VoidRequest, TrialBalanceResponse, TrialBalanceRow,
    LedgerResponse, LedgerLine, StatementLine,
    IncomeStatementResponse, BalanceSheetResponse,
    AccountingMappingCreate, AccountingMappingResponse,
)
from app.services import accounting as gl

logger = logging.getLogger(__name__)

router = APIRouter()


def _entry_response(entry: JournalEntry) -> JournalEntryResponse:
    """Serialize an entry with its line totals and account labels."""
    lines = []
    for line in entry.lines:
        lines.append(
            JournalLineResponse(
                id=line.id,
                account_id=line.account_id,
                account_code=line.account.code if line.account else None,
                account_name=line.account.name if line.account else None,
                line_number=line.line_number,
                debit=line.debit,
                credit=line.credit,
                memo=line.memo,
            )
        )
    return JournalEntryResponse(
        id=entry.id,
        entry_number=entry.entry_number,
        entry_date=entry.entry_date,
        memo=entry.memo,
        status=entry.status,
        source=entry.source,
        source_id=entry.source_id,
        posted_at=entry.posted_at,
        posted_by_id=entry.posted_by_id,
        created_by_id=entry.created_by_id,
        reverses_id=entry.reverses_id,
        company_id=entry.company_id,
        lines=lines,
        total_debit=gl.quantize(sum((l.debit for l in entry.lines), Decimal("0"))),
        total_credit=gl.quantize(sum((l.credit for l in entry.lines), Decimal("0"))),
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


async def _load_entry(db: AsyncSession, entry_id: int, company_id: int) -> JournalEntry:
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalLine.account))
        .where(and_(JournalEntry.id == entry_id, JournalEntry.company_id == company_id))
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


# --------------------------------------------------------------------------
# Chart of accounts
# --------------------------------------------------------------------------

@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(
    type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    query = select(Account).where(Account.company_id == current_user.company_id)
    if type:
        query = query.where(Account.type == type)
    if is_active is not None:
        query = query.where(Account.is_active == is_active)
    result = await db.execute(query.order_by(Account.code))
    return result.scalars().all()


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    existing = await db.execute(
        select(Account).where(
            and_(
                Account.company_id == current_user.company_id,
                Account.code == payload.code,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail=f"Account code '{payload.code}' already exists"
        )

    if payload.parent_id is not None:
        parent = await db.execute(
            select(Account).where(
                and_(
                    Account.id == payload.parent_id,
                    Account.company_id == current_user.company_id,
                )
            )
        )
        if parent.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Parent account not found")

    account = Account(
        code=payload.code,
        name=payload.name,
        type=payload.type,
        normal_balance=payload.normal_balance or NORMAL_BALANCE_BY_TYPE[payload.type],
        description=payload.description,
        parent_id=payload.parent_id,
        is_active=payload.is_active,
        company_id=current_user.company_id,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(Account).where(
            and_(Account.id == account_id, Account.company_id == current_user.company_id)
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    data = payload.model_dump(exclude_unset=True)

    # Deactivating an account with postings is fine - history stays intact,
    # it just cannot receive new ones.
    if data.get("parent_id") == account_id:
        raise HTTPException(status_code=400, detail="An account cannot be its own parent")

    for field, value in data.items():
        setattr(account, field, value)

    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Hard-delete an account, permitted only while it has no postings.

    Once an account has been posted to, deleting it would orphan ledger
    history. Deactivate instead.
    """
    result = await db.execute(
        select(Account).where(
            and_(Account.id == account_id, Account.company_id == current_user.company_id)
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    used = await db.execute(
        select(func.count(JournalLine.id)).where(JournalLine.account_id == account_id)
    )
    if (used.scalar_one() or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Account has journal activity and cannot be deleted; deactivate it instead",
        )

    mapped = await db.execute(
        select(func.count(AccountingMapping.id)).where(
            or_(
                AccountingMapping.debit_account_id == account_id,
                AccountingMapping.credit_account_id == account_id,
            )
        )
    )
    if (mapped.scalar_one() or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Account is used by an auto-post mapping; remove the mapping first",
        )

    await db.delete(account)
    await db.commit()


# --------------------------------------------------------------------------
# Journal entries
# --------------------------------------------------------------------------

@router.get("/journal-entries", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None,
    start: Optional[date_type] = None,
    end: Optional[date_type] = None,
    account_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(500, le=5000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    query = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalLine.account))
        .where(JournalEntry.company_id == current_user.company_id)
    )
    if status_filter:
        query = query.where(JournalEntry.status == status_filter)
    if source:
        query = query.where(JournalEntry.source == source)
    if start:
        query = query.where(JournalEntry.entry_date >= start)
    if end:
        query = query.where(JournalEntry.entry_date <= end)
    if account_id:
        query = query.where(
            JournalEntry.id.in_(
                select(JournalLine.journal_entry_id).where(JournalLine.account_id == account_id)
            )
        )

    query = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
    result = await db.execute(query.offset(skip).limit(limit))
    return [_entry_response(e) for e in result.scalars().unique().all()]


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
async def get_journal_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    entry = await _load_entry(db, entry_id, current_user.company_id)
    return _entry_response(entry)


@router.post(
    "/journal-entries",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_journal_entry(
    payload: JournalEntryCreate,
    post: bool = Query(False, description="Post immediately instead of saving as a draft"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    try:
        await gl.validate_accounts_exist(
            db, current_user.company_id, [l.account_id for l in payload.lines]
        )
    except gl.PostingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    entry = await gl.build_entry(
        db,
        company_id=current_user.company_id,
        entry_date=payload.entry_date,
        lines=[l.model_dump() for l in payload.lines],
        memo=payload.memo,
        source="manual",
        user_id=current_user.id,
    )

    if post:
        await db.flush()
        try:
            await gl.post_entry(db, entry, current_user.id)
        except gl.PostingError as exc:
            await db.rollback()
            raise HTTPException(status_code=422, detail=str(exc))
    else:
        await db.commit()

    entry = await _load_entry(db, entry.id, current_user.company_id)
    return _entry_response(entry)


@router.patch("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: int,
    payload: JournalEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    entry = await _load_entry(db, entry_id, current_user.company_id)

    if entry.status == "posted":
        raise HTTPException(
            status_code=409,
            detail="A posted entry is immutable. Reverse it and post a corrected entry.",
        )
    if entry.status == "void":
        raise HTTPException(status_code=409, detail="This entry has been voided")

    if payload.entry_date is not None:
        entry.entry_date = payload.entry_date
    if payload.memo is not None:
        entry.memo = payload.memo

    if payload.lines is not None:
        try:
            await gl.validate_accounts_exist(
                db, current_user.company_id, [l.account_id for l in payload.lines]
            )
        except gl.PostingError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        entry.lines.clear()
        await db.flush()
        for index, line in enumerate(payload.lines, start=1):
            entry.lines.append(
                JournalLine(
                    company_id=current_user.company_id,
                    account_id=line.account_id,
                    line_number=index,
                    debit=gl.quantize(line.debit),
                    credit=gl.quantize(line.credit),
                    memo=line.memo,
                )
            )

    await db.commit()
    entry = await _load_entry(db, entry_id, current_user.company_id)
    return _entry_response(entry)


@router.delete("/journal-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Discard a draft. Posted entries can only be reversed, never deleted."""
    entry = await _load_entry(db, entry_id, current_user.company_id)
    if entry.status == "posted":
        raise HTTPException(
            status_code=409,
            detail="A posted entry cannot be deleted. Reverse it instead.",
        )
    await db.delete(entry)
    await db.commit()


@router.post("/journal-entries/{entry_id}/post", response_model=JournalEntryResponse)
async def post_journal_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    entry = await _load_entry(db, entry_id, current_user.company_id)
    try:
        await gl.post_entry(db, entry, current_user.id)
    except gl.PostingError as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))

    entry = await _load_entry(db, entry_id, current_user.company_id)
    return _entry_response(entry)


@router.post("/journal-entries/{entry_id}/reverse", response_model=JournalEntryResponse)
async def reverse_journal_entry(
    entry_id: int,
    payload: VoidRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Post a reversing entry that cancels this one.

    The original stays in the ledger untouched. Returns the new reversing
    entry, not the original.
    """
    entry = await _load_entry(db, entry_id, current_user.company_id)
    try:
        reversal = await gl.create_reversal(
            db,
            entry,
            current_user.id,
            reversal_date=payload.reversal_date,
            memo=payload.memo,
        )
    except gl.PostingError as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))

    reversal = await _load_entry(db, reversal.id, current_user.company_id)
    return _entry_response(reversal)


# --------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------

async def _account_totals(
    db: AsyncSession,
    company_id: int,
    start: Optional[date_type] = None,
    end: Optional[date_type] = None,
):
    """
    Sum debits and credits per account over posted entries only.

    Drafts and voided entries are excluded - they are not the ledger.
    """
    query = (
        select(
            JournalLine.account_id,
            func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            and_(
                JournalLine.company_id == company_id,
                JournalEntry.status == "posted",
            )
        )
        .group_by(JournalLine.account_id)
    )
    if start:
        query = query.where(JournalEntry.entry_date >= start)
    if end:
        query = query.where(JournalEntry.entry_date <= end)

    result = await db.execute(query)
    return {
        row.account_id: (gl.quantize(row.total_debit), gl.quantize(row.total_credit))
        for row in result.all()
    }


@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def trial_balance(
    as_of: Optional[date_type] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    as_of = as_of or date_type.today()
    totals = await _account_totals(db, current_user.company_id, end=as_of)

    accounts = await db.execute(
        select(Account)
        .where(Account.company_id == current_user.company_id)
        .order_by(Account.code)
    )

    rows: List[TrialBalanceRow] = []
    total_debit = Decimal("0")
    total_credit = Decimal("0")

    for account in accounts.scalars().all():
        debit, credit = totals.get(account.id, (Decimal("0"), Decimal("0")))
        if debit == 0 and credit == 0:
            continue  # unused accounts add noise

        # Present the net on one side, which is what a trial balance shows.
        net = gl.quantize(debit - credit)
        row_debit = net if net > 0 else Decimal("0")
        row_credit = -net if net < 0 else Decimal("0")

        total_debit += row_debit
        total_credit += row_credit

        rows.append(
            TrialBalanceRow(
                account_id=account.id,
                code=account.code,
                name=account.name,
                type=account.type,
                normal_balance=account.normal_balance,
                debit=row_debit,
                credit=row_credit,
            )
        )

    return TrialBalanceResponse(
        as_of=as_of,
        rows=rows,
        total_debit=gl.quantize(total_debit),
        total_credit=gl.quantize(total_credit),
        is_balanced=gl.quantize(total_debit) == gl.quantize(total_credit),
    )


@router.get("/ledger/{account_id}", response_model=LedgerResponse)
async def account_ledger(
    account_id: int,
    start: Optional[date_type] = None,
    end: Optional[date_type] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    account_result = await db.execute(
        select(Account).where(
            and_(Account.id == account_id, Account.company_id == current_user.company_id)
        )
    )
    account = account_result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    sign = 1 if account.normal_balance == "debit" else -1

    # Opening balance is everything posted before the window starts.
    opening = Decimal("0")
    if start:
        prior = await db.execute(
            select(
                func.coalesce(func.sum(JournalLine.debit), 0),
                func.coalesce(func.sum(JournalLine.credit), 0),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .where(
                and_(
                    JournalLine.account_id == account_id,
                    JournalLine.company_id == current_user.company_id,
                    JournalEntry.status == "posted",
                    JournalEntry.entry_date < start,
                )
            )
        )
        prior_debit, prior_credit = prior.one()
        opening = gl.quantize((gl.quantize(prior_debit) - gl.quantize(prior_credit)) * sign)

    query = (
        select(JournalLine, JournalEntry)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .where(
            and_(
                JournalLine.account_id == account_id,
                JournalLine.company_id == current_user.company_id,
                JournalEntry.status == "posted",
            )
        )
    )
    if start:
        query = query.where(JournalEntry.entry_date >= start)
    if end:
        query = query.where(JournalEntry.entry_date <= end)
    query = query.order_by(JournalEntry.entry_date, JournalEntry.id, JournalLine.line_number)

    result = await db.execute(query)

    running = opening
    lines: List[LedgerLine] = []
    for line, entry in result.all():
        running = gl.quantize(running + (gl.quantize(line.debit) - gl.quantize(line.credit)) * sign)
        lines.append(
            LedgerLine(
                entry_id=entry.id,
                entry_number=entry.entry_number,
                entry_date=entry.entry_date,
                memo=entry.memo,
                source=entry.source,
                debit=line.debit,
                credit=line.credit,
                running_balance=running,
            )
        )

    return LedgerResponse(
        account_id=account.id,
        code=account.code,
        name=account.name,
        normal_balance=account.normal_balance,
        opening_balance=opening,
        closing_balance=running,
        lines=lines,
    )


@router.get("/income-statement", response_model=IncomeStatementResponse)
async def income_statement(
    start: Optional[date_type] = None,
    end: Optional[date_type] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    today = date_type.today()
    start = start or today.replace(month=1, day=1)
    end = end or today

    totals = await _account_totals(db, current_user.company_id, start=start, end=end)

    accounts = await db.execute(
        select(Account)
        .where(
            and_(
                Account.company_id == current_user.company_id,
                Account.type.in_(INCOME_STATEMENT_TYPES),
            )
        )
        .order_by(Account.code)
    )

    revenue: List[StatementLine] = []
    expenses: List[StatementLine] = []
    total_revenue = Decimal("0")
    total_expenses = Decimal("0")

    for account in accounts.scalars().all():
        debit, credit = totals.get(account.id, (Decimal("0"), Decimal("0")))
        if debit == 0 and credit == 0:
            continue
        amount = gl.signed_balance(account.type, debit, credit)
        line = StatementLine(
            account_id=account.id, code=account.code, name=account.name, amount=amount
        )
        if account.type == "revenue":
            revenue.append(line)
            total_revenue += amount
        else:
            expenses.append(line)
            total_expenses += amount

    return IncomeStatementResponse(
        start_date=start,
        end_date=end,
        revenue=revenue,
        expenses=expenses,
        total_revenue=gl.quantize(total_revenue),
        total_expenses=gl.quantize(total_expenses),
        net_income=gl.quantize(total_revenue - total_expenses),
    )


@router.get("/balance-sheet", response_model=BalanceSheetResponse)
async def balance_sheet(
    as_of: Optional[date_type] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    as_of = as_of or date_type.today()
    totals = await _account_totals(db, current_user.company_id, end=as_of)

    accounts = await db.execute(
        select(Account)
        .where(Account.company_id == current_user.company_id)
        .order_by(Account.code)
    )

    assets: List[StatementLine] = []
    liabilities: List[StatementLine] = []
    equity: List[StatementLine] = []
    total_assets = Decimal("0")
    total_liabilities = Decimal("0")
    total_equity = Decimal("0")
    retained = Decimal("0")

    for account in accounts.scalars().all():
        debit, credit = totals.get(account.id, (Decimal("0"), Decimal("0")))
        if debit == 0 and credit == 0:
            continue
        amount = gl.signed_balance(account.type, debit, credit)
        line = StatementLine(
            account_id=account.id, code=account.code, name=account.name, amount=amount
        )

        if account.type == "asset":
            assets.append(line)
            total_assets += amount
        elif account.type == "liability":
            liabilities.append(line)
            total_liabilities += amount
        elif account.type == "equity":
            equity.append(line)
            total_equity += amount
        elif account.type == "revenue":
            retained += amount
        elif account.type == "expense":
            retained -= amount

    # Retained earnings carries revenue less expenses through as_of. Without
    # it the sheet would not balance until a period-close entry is posted.
    retained = gl.quantize(retained)
    total_equity_with_retained = gl.quantize(total_equity + retained)

    return BalanceSheetResponse(
        as_of=as_of,
        assets=assets,
        liabilities=liabilities,
        equity=equity,
        total_assets=gl.quantize(total_assets),
        total_liabilities=gl.quantize(total_liabilities),
        total_equity=total_equity_with_retained,
        retained_earnings=retained,
        is_balanced=gl.quantize(total_assets)
        == gl.quantize(total_liabilities + total_equity_with_retained),
    )


# --------------------------------------------------------------------------
# Auto-post mappings
# --------------------------------------------------------------------------

@router.get("/mappings", response_model=List[AccountingMappingResponse])
async def list_mappings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(AccountingMapping)
        .options(
            selectinload(AccountingMapping.debit_account),
            selectinload(AccountingMapping.credit_account),
        )
        .where(AccountingMapping.company_id == current_user.company_id)
        .order_by(AccountingMapping.event_key)
    )
    return result.scalars().all()


@router.put("/mappings/{event_key}", response_model=AccountingMappingResponse)
async def upsert_mapping(
    event_key: str,
    payload: AccountingMappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Point an operational event at its debit and credit accounts.

    Until a mapping exists, that event silently skips auto-posting.
    """
    if event_key != payload.event_key:
        raise HTTPException(status_code=400, detail="event_key in path and body must match")

    try:
        await gl.validate_accounts_exist(
            db,
            current_user.company_id,
            [payload.debit_account_id, payload.credit_account_id],
        )
    except gl.PostingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    result = await db.execute(
        select(AccountingMapping).where(
            and_(
                AccountingMapping.company_id == current_user.company_id,
                AccountingMapping.event_key == event_key,
            )
        )
    )
    mapping = result.scalar_one_or_none()

    if mapping is None:
        mapping = AccountingMapping(
            company_id=current_user.company_id,
            event_key=event_key,
            debit_account_id=payload.debit_account_id,
            credit_account_id=payload.credit_account_id,
        )
        db.add(mapping)
    else:
        mapping.debit_account_id = payload.debit_account_id
        mapping.credit_account_id = payload.credit_account_id

    await db.commit()

    refreshed = await db.execute(
        select(AccountingMapping)
        .options(
            selectinload(AccountingMapping.debit_account),
            selectinload(AccountingMapping.credit_account),
        )
        .where(AccountingMapping.id == mapping.id)
    )
    return refreshed.scalar_one()


@router.delete("/mappings/{event_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mapping(
    event_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Remove a mapping. Entries already posted under it are unaffected."""
    result = await db.execute(
        select(AccountingMapping).where(
            and_(
                AccountingMapping.company_id == current_user.company_id,
                AccountingMapping.event_key == event_key,
            )
        )
    )
    mapping = result.scalar_one_or_none()
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await db.delete(mapping)
    await db.commit()
