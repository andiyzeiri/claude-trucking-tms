"""
Driver debt (Payroll > Debt tab): what each driver owes the company and the
payments against it.

A balance is built, oldest first, from:
  - debts entered by hand (advances, loans, damage)        -> balance up
  - payments entered by hand (cash, check)                  -> balance down
  - the Payroll page's "Debt Payment" row, week by week     -> balance down
  - fixed deductions (insurance, trailer...) in a week with  -> balance up
    no Gross, since there was no pay to take them out of

The Debt Payment row in a pay week (a week the driver has loads, or any
hand-entered payroll value) is what was typed for that week if anything,
else the driver's weekly deduction capped at what they still owe. A week
counts once it has started. The same per-week amounts are returned as
`schedule` so the Payroll page shows exactly what the ledger counted. If the
row is hidden in that driver's payroll table it takes nothing out, the same
as for net pay.

Unpaid fixed deductions count from UNPAID_FIXED_FROM (when this started) or
the driver's hire date / first activity, whichever is later, through the
current week and not past termination. A value typed into that week's cell
wins (type 0 to waive a charge). The weekly debt deduction only comes out of
weeks with Gross.
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
from app.models.driver_payroll_settings import DriverPayrollSettings
from app.models.driver_debt import DriverDebtEntry, DriverDebtPlan
from app.models.load import Load
from app.models.payroll_layout import PayrollLayout
from app.models.payroll_override import PayrollOverride
from app.models.user import User
from app.api.v1.endpoints.payroll_layout import default_rows

router = APIRouter()

ROW_KEY = "debt_payment"
UNPAID_FIXED_FROM = date(2026, 10, 5)  # ISO week 41 of 2026: no back-billing before this
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
    kind: Literal["debt", "payment", "payroll", "unpaid"]
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
    # "2026-41" -> {driver_id: amount}: fixed deductions in a week with no
    # Gross, added to the driver's debt (the Payroll page shows "to debt").
    unpaid: Dict[str, Dict[int, Decimal]] = {}


def _week_key(d: date) -> tuple:
    iso = d.isocalendar()
    return iso[0], iso[1]


def _week_end(year: int, week: int) -> date:
    return date.fromisocalendar(year, week, 7)


async def _layouts(db: AsyncSession, company_id: int) -> Dict[str, List[dict]]:
    """Payroll rows per table, the same fallbacks as the Payroll page."""
    saved = {
        l.driver_type: l.rows
        for l in (await db.execute(select(PayrollLayout).where(PayrollLayout.company_id == company_id))).scalars()
    }
    company = saved.get("company") or default_rows()
    return {t: saved.get(t) or company for t in ("company", "owner_operator", "company_owner")}


def _table_of(driver_type: Optional[str]) -> str:
    return driver_type if driver_type in ("owner_operator", "company_owner") else "company"


def _iso_weeks(first: date, last: date):
    """(year, week) of every ISO week from the one containing `first` to the one containing `last`."""
    day = first - timedelta(days=first.weekday())
    while day <= last:
        yield _week_key(day)
        day += timedelta(days=7)


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
    settings = {
        st.driver_id: st
        for st in (await db.execute(
            select(DriverPayrollSettings).where(DriverPayrollSettings.company_id == company_id)
        )).scalars()
    }
    layouts = await _layouts(db, company_id)
    drivers = {d.id: d for d in (await db.execute(select(Driver).where(Driver.company_id == company_id))).scalars()}

    # Hand-entered payroll values: driver -> (year, week) -> field -> amount
    typed_by_week: Dict[int, Dict[tuple, Dict[str, Decimal]]] = defaultdict(lambda: defaultdict(dict))
    for o in overrides:
        typed_by_week[o.driver_id][(o.year, o.week_number)][o.field] = Decimal(o.value)
    typed: Dict[int, Dict[tuple, Decimal]] = defaultdict(dict)  # driver -> week -> Debt Payment typed
    for driver_id, weeks in typed_by_week.items():
        for wk, fields in weeks.items():
            if ROW_KEY in fields:
                typed[driver_id][wk] = fields[ROW_KEY]

    # Weeks with loads (Gross), and each driver's first sign of activity.
    load_weeks: Dict[int, set] = defaultdict(set)
    first_seen: Dict[int, date] = {}
    for driver_id, pickup in (await db.execute(
        select(Load.driver_id, Load.pickup_date).where(
            Load.company_id == company_id, Load.driver_id.isnot(None), Load.pickup_date.isnot(None)
        )
    )).all():
        day = pickup.date() if isinstance(pickup, datetime) else pickup
        load_weeks[driver_id].add(_week_key(day))
        first_seen[driver_id] = min(first_seen.get(driver_id, day), day)
    for driver_id, weeks in typed_by_week.items():
        for (y, w) in weeks:
            day = date.fromisocalendar(y, w, 1)
            first_seen[driver_id] = min(first_seen.get(driver_id, day), day)

    def worked(driver_id: int, wk: tuple) -> bool:
        return wk in load_weeks[driver_id] or typed_by_week[driver_id].get(wk, {}).get("gross", Decimal(0)) > 0

    current_week = _week_key(today)
    unpaid: Dict[int, Dict[tuple, tuple]] = defaultdict(dict)  # driver -> week -> (amount, "Insurance $350, ...")

    for driver_id, driver in drivers.items():
        rows = [
            r for r in layouts[_table_of(driver.driver_type)]
            if r.get("kind") == "deduction" and not r.get("hidden") and r.get("key") != ROW_KEY
        ]
        st = settings.get(driver_id)

        def fixed_amount(r: dict) -> Decimal:
            if r.get("mode") != "fixed":
                return Decimal(0)
            if r.get("builtin"):
                return Decimal(str(getattr(st, f"{r['key']}_weekly", 0) or 0)) if st else Decimal(0)
            return Decimal(str((r.get("amounts") or {}).get(str(driver_id), 0) or 0))

        if not any(fixed_amount(r) for r in rows) and not typed_by_week.get(driver_id):
            continue
        begin = driver.date_hired or first_seen.get(driver_id)
        if begin is None:
            continue  # no hire date and never worked: nothing to charge
        begin = max(begin, UNPAID_FIXED_FROM)
        stop = min(today, driver.date_terminated) if driver.date_terminated else today
        if begin > stop:
            continue
        for wk in _iso_weeks(begin, stop):
            if wk > current_week or worked(driver_id, wk):
                continue
            typed_wk = typed_by_week[driver_id].get(wk, {})
            total, items = Decimal(0), []
            for r in rows:
                amt = typed_wk[r["key"]] if r["key"] in typed_wk else fixed_amount(r)
                if amt:
                    total += amt
                    items.append(f"{r.get('label') or r['key']} ${amt.quantize(CENT)}")
            if total > 0:
                unpaid[driver_id][wk] = (total.quantize(CENT), ", ".join(items))

    driver_ids = (
        {e.driver_id for e in entries} | {d for d, amt in plans.items() if amt > 0} | set(typed) | set(unpaid)
    ) & set(drivers)
    if not driver_ids:
        return DebtSummary(drivers=[], schedule={}, unpaid={})

    # Pay weeks, matching the Payroll page: any load picked up that week, or
    # any hand-entered payroll value for that week.
    pay_weeks: Dict[int, set] = defaultdict(set)
    for driver_id in driver_ids:
        pay_weeks[driver_id] |= load_weeks[driver_id] | set(typed_by_week[driver_id])

    hidden = {t: any(r.get("key") == ROW_KEY and r.get("hidden") for r in rows) for t, rows in layouts.items()}
    by_driver: Dict[int, List[DriverDebtEntry]] = defaultdict(list)
    for e in entries:
        by_driver[e.driver_id].append(e)

    schedule: Dict[str, Dict[int, Decimal]] = defaultdict(dict)
    unpaid_out: Dict[str, Dict[int, Decimal]] = defaultdict(dict)
    out: List[DriverDebt] = []

    for driver_id in driver_ids:
        driver = drivers[driver_id]
        weekly = plans.get(driver_id, Decimal(0))
        row_hidden = hidden[_table_of(driver.driver_type)]

        # (date, order, kind, payload): same day -> debts first, then hand payments, then payroll
        events = []
        for e in by_driver[driver_id]:
            events.append((e.entry_date, 0 if e.kind == "debt" else 1, e.kind, e))
        for wk, (amt, items) in unpaid[driver_id].items():
            events.append((_week_end(*wk), 0, "unpaid", (wk, amt, items)))
            unpaid_out[f"{wk[0]}-{wk[1]}"][driver_id] = amt
        first_debt = min(
            [e.entry_date for e in by_driver[driver_id] if e.kind == "debt"] + [_week_end(*wk) for wk in unpaid[driver_id]],
            default=None,
        )
        if not row_hidden:
            for wk in pay_weeks[driver_id]:
                if wk > current_week:
                    continue  # hasn't started
                # The weekly deduction only comes out of a week with Gross.
                auto = weekly > 0 and first_debt and _week_end(*wk) >= first_debt and worked(driver_id, wk)
                if wk in typed[driver_id] or auto:
                    events.append((_week_end(*wk), 2, "payroll", wk))
        events.sort(key=lambda ev: (ev[0], ev[1]))

        balance = total_debt = total_paid = Decimal(0)
        history: List[HistoryItem] = []
        last_date = last_amount = None
        for when, _, kind, payload in events:
            if kind in ("debt", "unpaid"):
                if kind == "debt":
                    amt, note, item_id, week = Decimal(payload.amount), payload.note, payload.id, None
                else:
                    wk, amt, items = payload
                    note, item_id, week = f"Week {wk[1]}: {items} (no gross)", None, f"{wk[0]}-{wk[1]}"
                balance += amt
                total_debt += amt
                history.append(HistoryItem(id=item_id, date=when, kind=kind, amount=amt, note=note, week=week, balance=balance))
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
    return DebtSummary(drivers=out, schedule=schedule, unpaid=unpaid_out)


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
