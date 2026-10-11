"""
Driver debt (Payroll > Debt tab): what each driver owes the company and the
payments against it.

A balance is built, oldest first, from:
  - debts entered by hand (advances, loans, damage)        -> balance up
  - payments entered by hand (cash, check)                  -> balance down
  - the Payroll page's "Debt Payment" row, week by week     -> balance down

The Debt Payment row in a pay week (a week the driver has loads, or any
hand-entered payroll value) is what was typed for that week if anything,
else the driver's weekly deduction capped at what they still owe. A week
counts once it has started. The same per-week amounts are returned as
`schedule` so the Payroll page shows exactly what the ledger counted. If the
row is hidden in that driver's payroll table it takes nothing out, the same
as for net pay.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, condecimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.database import get_db
from app.models.driver import Driver
from app.models.driver_debt import DriverDebtEntry, DriverDebtPlan
from app.models.load import Load
from app.models.payroll_layout import PayrollLayout
from app.models.payroll_override import PayrollOverride
from app.models.user import User

router = APIRouter()

ROW_KEY = "debt_payment"
CENT = Decimal("0.01")
Money = condecimal(gt=0, max_digits=12, decimal_places=2)


class EntryIn(BaseModel):
    driver_id: int
    kind: Literal["debt", "payment"]
    amount: Money
    entry_date: date
    note: Optional[str] = Field(None, max_length=255)


class PlanIn(BaseModel):
    weekly_amount: condecimal(ge=0, max_digits=12, decimal_places=2)


class HistoryItem(BaseModel):
    id: Optional[int] = None  # set for hand-entered rows (deletable)
    date: date
    kind: Literal["debt", "payment", "payroll"]
    amount: Decimal  # positive; kind says which way
    note: Optional[str] = None
    week: Optional[str] = None  # "2026-41" for payroll payments
    balance: Decimal  # running balance after this item


class DriverDebt(BaseModel):
    driver_id: int
    driver_name: str
    driver_type: str
    balance: Decimal
    total_debt: Decimal
    total_paid: Decimal
    weekly_amount: Decimal
    last_payment_date: Optional[date] = None
    last_payment_amount: Optional[Decimal] = None
    history: List[HistoryItem]  # newest first


class DebtSummary(BaseModel):
    drivers: List[DriverDebt]
    # "2026-41" -> {driver_id: amount} for the weeks the Debt Payment row was
    # filled automatically (hand-typed weeks come from payroll overrides).
    schedule: Dict[str, Dict[int, Decimal]]


def _week_key(d: date) -> tuple:
    iso = d.isocalendar()
    return iso[0], iso[1]


def _week_end(year: int, week: int) -> date:
    return date.fromisocalendar(year, week, 7)


async def _debt_row_hidden(db: AsyncSession, company_id: int) -> Dict[str, bool]:
    """Whether the Debt Payment row is hidden, per payroll table."""
    layouts = {
        l.driver_type: l.rows
        for l in (await db.execute(select(PayrollLayout).where(PayrollLayout.company_id == company_id))).scalars()
    }

    def hidden(rows) -> bool:
        return any(r.get("key") == ROW_KEY and r.get("hidden") for r in rows or [])

    company = layouts.get("company")
    return {t: hidden(layouts.get(t, company)) for t in ("company", "owner_operator", "company_owner")}


def _table_of(driver_type: Optional[str]) -> str:
    return driver_type if driver_type in ("owner_operator", "company_owner") else "company"


async def build_summary(db: AsyncSession, company_id: int, today: Optional[date] = None) -> DebtSummary:
    today = today or date.today()
    entries = (await db.execute(
        select(DriverDebtEntry).where(DriverDebtEntry.company_id == company_id, DriverDebtEntry.deleted_at.is_(None))
    )).scalars().all()
    plans = {
        p.driver_id: Decimal(p.weekly_amount or 0)
        for p in (await db.execute(select(DriverDebtPlan).where(DriverDebtPlan.company_id == company_id))).scalars()
    }
    overrides = (await db.execute(
        select(PayrollOverride).where(PayrollOverride.company_id == company_id, PayrollOverride.field != "truck_id")
    )).scalars().all()

    typed: Dict[int, Dict[tuple, Decimal]] = defaultdict(dict)  # driver -> (year, week) -> amount typed
    for o in overrides:
        if o.field == ROW_KEY:
            typed[o.driver_id][(o.year, o.week_number)] = Decimal(o.value)

    driver_ids = {e.driver_id for e in entries} | {d for d, amt in plans.items() if amt > 0} | set(typed)
    if not driver_ids:
        return DebtSummary(drivers=[], schedule={})

    drivers = {
        d.id: d for d in (await db.execute(
            select(Driver).where(Driver.company_id == company_id, Driver.id.in_(driver_ids))
        )).scalars()
    }

    # Pay weeks, matching the Payroll page: any load picked up that week, or
    # any hand-entered payroll value for that week.
    pay_weeks: Dict[int, set] = defaultdict(set)
    for driver_id, pickup in (await db.execute(
        select(Load.driver_id, Load.pickup_date).where(
            Load.company_id == company_id, Load.driver_id.in_(driver_ids), Load.pickup_date.isnot(None)
        )
    )).all():
        pay_weeks[driver_id].add(_week_key(pickup.date() if isinstance(pickup, datetime) else pickup))
    for o in overrides:
        if o.driver_id in driver_ids:
            pay_weeks[o.driver_id].add((o.year, o.week_number))

    hidden = await _debt_row_hidden(db, company_id)
    by_driver: Dict[int, List[DriverDebtEntry]] = defaultdict(list)
    for e in entries:
        by_driver[e.driver_id].append(e)

    current_week = _week_key(today)
    schedule: Dict[str, Dict[int, Decimal]] = defaultdict(dict)
    out: List[DriverDebt] = []

    for driver_id in driver_ids:
        driver = drivers.get(driver_id)
        if driver is None:
            continue
        weekly = plans.get(driver_id, Decimal(0))
        row_hidden = hidden[_table_of(driver.driver_type)]

        # (date, order, kind, payload): same day -> debts first, then hand payments, then payroll
        events = []
        for e in by_driver[driver_id]:
            events.append((e.entry_date, 0 if e.kind == "debt" else 1, e.kind, e))
        first_debt = min((e.entry_date for e in by_driver[driver_id] if e.kind == "debt"), default=None)
        if not row_hidden:
            for wk in pay_weeks[driver_id]:
                if wk > current_week:
                    continue  # hasn't started
                if wk in typed[driver_id] or (weekly > 0 and first_debt and _week_end(*wk) >= first_debt):
                    events.append((_week_end(*wk), 2, "payroll", wk))
        events.sort(key=lambda ev: (ev[0], ev[1]))

        balance = total_debt = total_paid = Decimal(0)
        history: List[HistoryItem] = []
        last_date = last_amount = None
        for when, _, kind, payload in events:
            if kind == "debt":
                amt = Decimal(payload.amount)
                balance += amt
                total_debt += amt
                history.append(HistoryItem(id=payload.id, date=when, kind="debt", amount=amt, note=payload.note, balance=balance))
                continue
            if kind == "payment":
                amt = Decimal(payload.amount)
                note = payload.note
                item_id = payload.id
                week = None
            else:
                wk = payload
                if wk in typed[driver_id]:
                    amt = typed[driver_id][wk]  # as typed; negative adds to the debt
                else:
                    amt = min(weekly, balance).quantize(CENT) if balance > 0 else Decimal(0)
                    if amt > 0:
                        schedule[f"{wk[0]}-{wk[1]}"][driver_id] = amt
                if amt == 0:
                    continue
                note, item_id, week = None, None, f"{wk[0]}-{wk[1]}"
            balance -= amt
            total_paid += amt
            history.append(HistoryItem(
                id=item_id, date=when, kind="payment" if kind == "payment" else "payroll",
                amount=amt, note=note, week=week, balance=balance,
            ))
            if amt > 0:
                last_date, last_amount = when, amt

        out.append(DriverDebt(
            driver_id=driver_id,
            driver_name=f"{driver.first_name} {driver.last_name}".strip(),
            driver_type=driver.driver_type or "company",
            balance=balance, total_debt=total_debt, total_paid=total_paid,
            weekly_amount=weekly, last_payment_date=last_date, last_payment_amount=last_amount,
            history=list(reversed(history)),
        ))

    out.sort(key=lambda d: (-d.balance, d.driver_name))
    return DebtSummary(drivers=out, schedule=schedule)


async def _driver(db: AsyncSession, company_id: int, driver_id: int) -> Driver:
    driver = await db.get(Driver, driver_id)
    if driver is None or driver.company_id != company_id:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.get("/", response_model=DebtSummary)
async def get_debts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await build_summary(db, current_user.company_id)


@router.post("/entries", response_model=DebtSummary)
async def add_entry(
    body: EntryIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await _driver(db, current_user.company_id, body.driver_id)
    db.add(DriverDebtEntry(
        company_id=current_user.company_id, driver_id=body.driver_id, kind=body.kind,
        amount=body.amount, entry_date=body.entry_date,
        note=(body.note or "").strip() or None, created_by=current_user.id,
    ))
    await db.commit()
    return await build_summary(db, current_user.company_id)


@router.delete("/entries/{entry_id}", response_model=DebtSummary)
async def delete_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entry = await db.get(DriverDebtEntry, entry_id)
    if entry is None or entry.company_id != current_user.company_id or entry.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return await build_summary(db, current_user.company_id)


@router.put("/plans/{driver_id}", response_model=DebtSummary)
async def set_plan(
    driver_id: int,
    body: PlanIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await _driver(db, current_user.company_id, driver_id)
    plan = (await db.execute(select(DriverDebtPlan).where(DriverDebtPlan.driver_id == driver_id))).scalar_one_or_none()
    if plan is None:
        db.add(DriverDebtPlan(company_id=current_user.company_id, driver_id=driver_id, weekly_amount=body.weekly_amount))
    else:
        plan.weekly_amount = body.weekly_amount
    await db.commit()
    return await build_summary(db, current_user.company_id)
