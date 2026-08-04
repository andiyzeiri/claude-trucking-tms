"""
Double-entry posting engine.

Two rules govern everything here:

1. A posted entry balances. Sum of debits equals sum of credits, exactly,
   in Decimal. Never float.
2. A posted entry is immutable. Corrections are reversing entries, not
   edits. The ledger is append-only because it is an audit record.

Auto-posting from the operational subledgers (invoices, fuel, expenses,
payroll) runs through sync_source_entry, which is wrapped by
auto_post_safe. That wrapper swallows every exception by design: a
bookkeeping failure must never stop a dispatcher from invoicing a load.
"""

import logging
from datetime import date as date_type, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence

from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account, NORMAL_BALANCE_BY_TYPE
from app.models.accounting_mapping import AccountingMapping
from app.models.journal_entry import JournalEntry, JournalLine

logger = logging.getLogger(__name__)

# Money is numeric(12,4) in the ledger.
CENTS = Decimal("0.0001")

# How many times to retry entry-number assignment when two posts race for
# the same sequence number. The unique constraint is the real guard; this
# just turns a collision into a retry instead of a 500.
_NUMBER_RETRIES = 5


class PostingError(Exception):
    """Raised when an entry cannot be posted. Carries a user-safe message."""


def quantize(amount) -> Decimal:
    """Coerce any numeric input to ledger precision. Never accepts float silently."""
    if amount is None:
        return Decimal("0")
    if isinstance(amount, float):
        # Float money is a bug upstream, but rounding it here beats
        # propagating binary error into the ledger.
        amount = Decimal(str(amount))
    elif not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    return amount.quantize(CENTS, rounding=ROUND_HALF_UP)


def normal_balance_for(account_type: str) -> str:
    return NORMAL_BALANCE_BY_TYPE.get(account_type, "debit")


def signed_balance(account_type: str, total_debit: Decimal, total_credit: Decimal) -> Decimal:
    """
    Balance expressed positively on the account's normal side.

    A revenue account with 10,000 in credits reports +10,000, not -10,000.
    """
    if normal_balance_for(account_type) == "debit":
        return quantize(total_debit - total_credit)
    return quantize(total_credit - total_debit)


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

def imbalance(lines: Sequence) -> Decimal:
    """Debits minus credits. Zero means the entry balances."""
    total_debit = sum((quantize(l.debit) for l in lines), Decimal("0"))
    total_credit = sum((quantize(l.credit) for l in lines), Decimal("0"))
    return quantize(total_debit - total_credit)


def entry_total(lines: Sequence) -> Decimal:
    """Total value of the entry, measured on the debit side."""
    return quantize(sum((quantize(l.debit) for l in lines), Decimal("0")))


async def validate_accounts_exist(
    db: AsyncSession, company_id: int, account_ids: Sequence[int]
) -> None:
    """
    Every referenced account must belong to this company and be active.

    Cross-tenant account references are the worst failure mode here - it
    would post one company's money into another's books - so this check
    is not optional even though the FK would pass.
    """
    unique_ids = list({int(a) for a in account_ids})
    if not unique_ids:
        raise PostingError("entry has no lines")

    result = await db.execute(
        select(Account.id, Account.is_active).where(
            and_(Account.id.in_(unique_ids), Account.company_id == company_id)
        )
    )
    found = {row[0]: row[1] for row in result.all()}

    missing = [a for a in unique_ids if a not in found]
    if missing:
        raise PostingError(f"account(s) not found for this company: {sorted(missing)}")

    inactive = [a for a in unique_ids if not found[a]]
    if inactive:
        raise PostingError(f"cannot post to inactive account(s): {sorted(inactive)}")


# --------------------------------------------------------------------------
# Entry numbering
# --------------------------------------------------------------------------

async def next_entry_number(db: AsyncSession, company_id: int, entry_date: date_type) -> str:
    """
    Next number in the company's per-year sequence, e.g. JE-2026-000123.

    Assigned at post time so abandoned drafts don't consume numbers.
    """
    year = entry_date.year
    prefix = f"JE-{year}-"

    result = await db.execute(
        select(func.max(JournalEntry.entry_number)).where(
            and_(
                JournalEntry.company_id == company_id,
                JournalEntry.entry_number.like(f"{prefix}%"),
            )
        )
    )
    highest = result.scalar_one_or_none()

    if not highest:
        sequence = 1
    else:
        try:
            sequence = int(highest.rsplit("-", 1)[1]) + 1
        except (IndexError, ValueError):
            # Malformed number in the table - fall back to counting rather
            # than crashing the post.
            count_result = await db.execute(
                select(func.count(JournalEntry.id)).where(
                    and_(
                        JournalEntry.company_id == company_id,
                        JournalEntry.entry_number.like(f"{prefix}%"),
                    )
                )
            )
            sequence = (count_result.scalar_one() or 0) + 1

    return f"{prefix}{sequence:06d}"


# --------------------------------------------------------------------------
# Posting
# --------------------------------------------------------------------------

async def post_entry(
    db: AsyncSession,
    entry: JournalEntry,
    user_id: Optional[int],
    commit: bool = True,
) -> JournalEntry:
    """
    Validate and post a draft entry.

    Balance is checked here rather than at the database level because the
    rule spans rows. The check and the status flip happen in one
    transaction, so a half-posted entry is not reachable.
    """
    if entry.status == "posted":
        raise PostingError(f"entry {entry.entry_number or entry.id} is already posted")
    if entry.status == "void":
        raise PostingError("cannot post a voided entry")

    lines = entry.lines
    if not lines or len(lines) < 2:
        raise PostingError("an entry needs at least two lines")

    diff = imbalance(lines)
    if diff != 0:
        raise PostingError(f"entry does not balance - debits exceed credits by {diff}")

    if entry_total(lines) == 0:
        raise PostingError("entry total must be greater than zero")

    await validate_accounts_exist(db, entry.company_id, [l.account_id for l in lines])

    last_error: Optional[Exception] = None
    for _ in range(_NUMBER_RETRIES):
        entry.entry_number = await next_entry_number(db, entry.company_id, entry.entry_date)
        entry.status = "posted"
        entry.posted_at = datetime.now(timezone.utc)
        entry.posted_by_id = user_id
        try:
            if commit:
                await db.commit()
                await db.refresh(entry)
                # refresh() expires the relationship, so reload it here.
                # Otherwise the caller touching entry.lines triggers a lazy
                # load outside the async context and raises MissingGreenlet.
                await db.refresh(entry, ["lines"])
            else:
                await db.flush()
            return entry
        except IntegrityError as exc:
            # Almost certainly je_company_number_uniq: another post claimed
            # this number first. Roll back and take the next one.
            last_error = exc
            await db.rollback()
            entry = await db.merge(entry)
            entry.status = "draft"

    raise PostingError(f"could not assign an entry number after {_NUMBER_RETRIES} attempts: {last_error}")


async def build_entry(
    db: AsyncSession,
    company_id: int,
    entry_date: date_type,
    lines: Sequence[dict],
    memo: Optional[str] = None,
    source: str = "manual",
    source_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> JournalEntry:
    """
    Construct an unsaved draft entry from plain dicts.

    Each line dict takes account_id and one of debit/credit.
    """
    entry = JournalEntry(
        company_id=company_id,
        entry_date=entry_date,
        memo=memo,
        source=source,
        source_id=source_id,
        status="draft",
        created_by_id=user_id,
    )

    for index, raw in enumerate(lines, start=1):
        entry.lines.append(
            JournalLine(
                company_id=company_id,
                account_id=raw["account_id"],
                line_number=index,
                debit=quantize(raw.get("debit", 0)),
                credit=quantize(raw.get("credit", 0)),
                memo=raw.get("memo"),
            )
        )

    db.add(entry)
    return entry


async def create_reversal(
    db: AsyncSession,
    original: JournalEntry,
    user_id: Optional[int],
    reversal_date: Optional[date_type] = None,
    memo: Optional[str] = None,
    commit: bool = True,
) -> JournalEntry:
    """
    Post a reversing entry that cancels `original`.

    Debits become credits and credits become debits. The original is left
    untouched and stays in the ledger - that is the point. Net effect on
    every affected account is zero.
    """
    if original.status != "posted":
        raise PostingError("only a posted entry can be reversed")

    existing = await find_reversal_of(db, original.id)
    if existing is not None:
        raise PostingError(
            f"entry {original.entry_number or original.id} was already reversed by {existing.entry_number or existing.id}"
        )

    reversal = JournalEntry(
        company_id=original.company_id,
        entry_date=reversal_date or original.entry_date,
        memo=memo or f"Reversal of {original.entry_number or original.id}",
        source=original.source,
        source_id=original.source_id,
        status="draft",
        created_by_id=user_id,
        reverses_id=original.id,
    )

    for index, line in enumerate(original.lines, start=1):
        reversal.lines.append(
            JournalLine(
                company_id=original.company_id,
                account_id=line.account_id,
                line_number=index,
                debit=quantize(line.credit),   # swapped
                credit=quantize(line.debit),   # swapped
                memo=line.memo,
            )
        )

    db.add(reversal)
    await db.flush()
    return await post_entry(db, reversal, user_id, commit=commit)


async def find_reversal_of(db: AsyncSession, entry_id: int) -> Optional[JournalEntry]:
    """The posted entry that reverses `entry_id`, if one exists."""
    result = await db.execute(
        select(JournalEntry).where(
            and_(
                JournalEntry.reverses_id == entry_id,
                JournalEntry.status == "posted",
            )
        )
    )
    return result.scalars().first()


# --------------------------------------------------------------------------
# Auto-posting from the operational subledgers
# --------------------------------------------------------------------------

async def get_mapping(
    db: AsyncSession, company_id: int, event_key: str
) -> Optional[AccountingMapping]:
    result = await db.execute(
        select(AccountingMapping).where(
            and_(
                AccountingMapping.company_id == company_id,
                AccountingMapping.event_key == event_key,
            )
        )
    )
    return result.scalars().first()


async def find_active_source_entry(
    db: AsyncSession, company_id: int, source: str, source_id: int
) -> Optional[JournalEntry]:
    """
    The live posted entry for a source record - posted, not itself a
    reversal, and not already reversed.
    """
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(
            and_(
                JournalEntry.company_id == company_id,
                JournalEntry.source == source,
                JournalEntry.source_id == source_id,
                JournalEntry.status == "posted",
                JournalEntry.reverses_id.is_(None),
            )
        )
        .order_by(JournalEntry.id.desc())
    )
    for candidate in result.scalars().all():
        if await find_reversal_of(db, candidate.id) is None:
            return candidate
    return None


async def sync_source_entry(
    db: AsyncSession,
    company_id: int,
    event_key: str,
    source_id: int,
    amount,
    entry_date: date_type,
    memo: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Optional[JournalEntry]:
    """
    Bring the ledger in line with one source record.

    Handles create, update, and delete uniformly:
      - no live entry, amount > 0     -> post a new entry
      - live entry, amount unchanged  -> no-op
      - live entry, amount changed    -> reverse the old, post the new
      - live entry, amount is None/0  -> reverse only (record was deleted)

    Returns the newly posted entry, or None if nothing was posted.
    """
    mapping = await get_mapping(db, company_id, event_key)
    if mapping is None:
        logger.info(
            "accounting: no '%s' mapping for company %s - skipping auto-post of %s #%s",
            event_key, company_id, event_key, source_id,
        )
        return None

    desired = quantize(amount) if amount is not None else Decimal("0")
    if desired < 0:
        # A negative subledger amount means a credit memo. Swapping the
        # sides is a real accounting decision, not something to guess at,
        # so it is left for a manual entry.
        logger.warning(
            "accounting: negative amount %s on %s #%s (company %s) - skipping auto-post, "
            "post a manual credit memo instead",
            desired, event_key, source_id, company_id,
        )
        return None

    existing = await find_active_source_entry(db, company_id, event_key, source_id)

    if existing is not None:
        current = entry_total(existing.lines)
        same_amount = current == desired
        same_date = existing.entry_date == entry_date
        if same_amount and same_date and desired > 0:
            return None  # already correct
        await create_reversal(
            db,
            existing,
            user_id,
            reversal_date=entry_date,
            memo=f"Auto-reversal: {event_key} #{source_id} changed",
            commit=False,
        )

    if desired == 0:
        await db.commit()
        return None

    entry = await build_entry(
        db,
        company_id=company_id,
        entry_date=entry_date,
        lines=[
            {"account_id": mapping.debit_account_id, "debit": desired},
            {"account_id": mapping.credit_account_id, "credit": desired},
        ],
        memo=memo or f"Auto-posted from {event_key} #{source_id}",
        source=event_key,
        source_id=source_id,
        user_id=user_id,
    )
    await db.flush()
    return await post_entry(db, entry, user_id, commit=True)


def as_entry_date(value) -> Optional[date_type]:
    """Accept a date or datetime from a subledger row and return a date."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


async def auto_post_safe(
    company_id: int,
    event_key: str,
    source_id: int,
    amount,
    entry_date,
    memo: Optional[str] = None,
    user_id: Optional[int] = None,
) -> None:
    """
    sync_source_entry with a hard guarantee that it cannot raise.

    Runs in its own session and its own transaction, deliberately. The
    caller's business record is already committed by the time this runs,
    and nothing that happens in here - bad mapping, missing account,
    arithmetic that will not balance - can touch it. A bookkeeping
    failure degrades to a log line; it never costs a dispatcher an
    invoice or a fuel receipt. Anything skipped can be posted by hand.

    Call AFTER the business commit. Never inside its transaction.
    """
    entry_date = as_entry_date(entry_date)
    if entry_date is None:
        logger.warning(
            "accounting: no date on %s #%s (company %s) - skipping auto-post",
            event_key, source_id, company_id,
        )
        return

    # Imported here to avoid a circular import at module load.
    from app.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            try:
                await sync_source_entry(
                    session,
                    company_id=company_id,
                    event_key=event_key,
                    source_id=source_id,
                    amount=amount,
                    entry_date=entry_date,
                    memo=memo,
                    user_id=user_id,
                )
            except Exception:
                await session.rollback()
                raise
    except Exception:
        logger.exception(
            "accounting: auto-post failed for %s #%s (company %s) - "
            "business record is unaffected, post this entry manually",
            event_key, source_id, company_id,
        )
