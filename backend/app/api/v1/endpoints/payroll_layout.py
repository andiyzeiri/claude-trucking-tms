"""
Payroll page rows, per company and driver type: which line items show, in what order, and
how each is filled (see app/models/payroll_layout.py).

The built-in rows always exist (they can be hidden, not deleted) and keep
their key, kind and - except where switching makes sense - their mode, so a
bad request can't turn Fuel into an earning or make Gross "fixed".
"""

import re
import uuid
from typing import Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.database import get_db
from app.models.payroll_layout import PayrollLayout
from app.models.user import User

router = APIRouter()

DriverType = Literal["company", "owner_operator", "company_owner"]
DRIVER_TYPES = ("company", "owner_operator", "company_owner")
Kind = Literal["earning", "deduction", "info"]
Mode = Literal["auto", "fixed", "variable"]

# key, label, kind, default mode, modes the user may pick
BUILTIN = [
    ("gross", "Gross", "earning", "auto", ("auto",)),
    ("extra", "Extra", "earning", "variable", ("variable",)),
    ("dispatch_fee", "Dispatch", "deduction", "auto", ("auto",)),
    ("insurance", "Insurance", "deduction", "fixed", ("fixed", "variable")),
    ("fuel", "Fuel", "deduction", "auto", ("auto",)),
    ("parking", "Parking", "deduction", "fixed", ("fixed", "variable")),
    ("trailer", "Trailer", "deduction", "fixed", ("fixed", "variable")),
    ("misc", "Misc", "deduction", "fixed", ("fixed", "variable")),
    # Filled from the driver's weekly debt deduction (Debt tab), capped at what they owe.
    ("debt_payment", "Debt Payment", "deduction", "auto", ("auto",)),
    ("miles", "Miles", "info", "auto", ("auto",)),
]
BUILTIN_BY_KEY = {b[0]: b for b in BUILTIN}
CUSTOM_KEY = re.compile(r"^custom_[a-z0-9]{4,20}$")
MAX_ROWS = 40


class LayoutRow(BaseModel):
    key: str = ""  # empty for a new custom row; the server assigns one
    label: str = Field(..., min_length=1, max_length=40)
    kind: Kind
    mode: Mode
    hidden: bool = False
    builtin: bool = False
    amounts: Dict[str, float] = {}  # driver_id -> weekly amount (fixed custom rows)


class Layout(BaseModel):
    rows: List[LayoutRow]


def default_rows() -> List[dict]:
    return [
        {"key": k, "label": label, "kind": kind, "mode": mode, "hidden": False, "builtin": True, "amounts": {}}
        for k, label, kind, mode, _ in BUILTIN
    ]


def normalize(rows: List[LayoutRow]) -> List[dict]:
    if len(rows) > MAX_ROWS:
        raise HTTPException(status_code=422, detail=f"At most {MAX_ROWS} rows")
    out, seen = [], set()
    for r in rows:
        label = r.label.strip()
        if not label:
            raise HTTPException(status_code=422, detail="Every row needs a name")
        if r.key in BUILTIN_BY_KEY:
            key, default_label, kind, _, modes = BUILTIN_BY_KEY[r.key]
            mode = r.mode if r.mode in modes else modes[0]
            row = {"key": key, "label": label, "kind": kind, "mode": mode, "hidden": r.hidden, "builtin": True, "amounts": {}}
        else:
            if r.key and not CUSTOM_KEY.match(r.key):
                raise HTTPException(status_code=422, detail=f"Unknown row {r.key!r}")
            if r.kind not in ("earning", "deduction"):
                raise HTTPException(status_code=422, detail=f"{label}: pick earning or deduction")
            if r.mode not in ("fixed", "variable"):
                raise HTTPException(status_code=422, detail=f"{label}: pick fixed or variable")
            amounts = {}
            for driver_id, amount in (r.amounts or {}).items():
                if not str(driver_id).isdigit():
                    raise HTTPException(status_code=422, detail=f"{label}: bad driver id")
                if round(float(amount), 2):
                    amounts[str(driver_id)] = round(float(amount), 2)
            row = {
                "key": r.key or f"custom_{uuid.uuid4().hex[:10]}",
                "label": label, "kind": r.kind, "mode": r.mode,
                "hidden": r.hidden, "builtin": False, "amounts": amounts,
            }
        if row["key"] in seen:
            raise HTTPException(status_code=422, detail=f"Row {label!r} appears twice")
        seen.add(row["key"])
        out.append(row)
    # Built-in rows can be hidden but never dropped; the page always sends all
    # of them, so a missing one is new since this layout was saved - show it,
    # just above Miles.
    for b in default_rows():
        if b["key"] not in seen:
            at = next((i for i, r in enumerate(out) if r["key"] == "miles"), len(out))
            out.insert(at, b)
    return out


async def _get(db: AsyncSession, company_id: int, driver_type: str):
    return (
        await db.execute(select(PayrollLayout).where(
            PayrollLayout.company_id == company_id,
            PayrollLayout.driver_type == driver_type,
        ))
    ).scalar_one_or_none()


@router.get("/", response_model=Layout)
async def get_layout(
    driver_type: DriverType = Query("company"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    layout = await _get(db, current_user.company_id, driver_type)
    if layout is None and driver_type != "company":
        # Owner operators and company owners start from the company drivers'
        # rows until their own are edited.
        layout = await _get(db, current_user.company_id, "company")
    if layout is None:
        return {"rows": default_rows()}
    # Re-normalize so rows saved before a new built-in existed pick it up.
    return {"rows": normalize([LayoutRow(**r) for r in layout.rows])}


@router.put("/", response_model=Layout)
async def save_layout(
    body: Layout,
    driver_type: DriverType = Query("company"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rows = normalize(body.rows)
    layout = await _get(db, current_user.company_id, driver_type)
    if driver_type == "company":
        # The other tables have been showing the company rows (see get_layout);
        # pin those for them first so editing one table never changes another.
        for other in DRIVER_TYPES[1:]:
            if await _get(db, current_user.company_id, other) is None:
                db.add(PayrollLayout(
                    company_id=current_user.company_id, driver_type=other,
                    rows=layout.rows if layout is not None else default_rows(),
                ))
    if layout is None:
        db.add(PayrollLayout(company_id=current_user.company_id, driver_type=driver_type, rows=rows))
    else:
        layout.rows = rows
    await db.commit()
    return {"rows": rows}


class DriverOrder(BaseModel):
    driver_order: List[int]


@router.get("/driver-order", response_model=DriverOrder)
async def get_driver_order(
    driver_type: DriverType = Query("company"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    layout = await _get(db, current_user.company_id, driver_type)
    return {"driver_order": (layout.driver_order if layout is not None else None) or []}


@router.put("/driver-order", response_model=DriverOrder)
async def save_driver_order(
    body: DriverOrder,
    driver_type: DriverType = Query("company"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Order of the driver columns on the Payroll page; ids the page doesn't know are harmless."""
    order = list(dict.fromkeys(body.driver_order))[:1000]
    layout = await _get(db, current_user.company_id, driver_type)
    if layout is None:
        # No rows saved for this table yet: keep showing what it shows now.
        fallback = await _get(db, current_user.company_id, "company") if driver_type != "company" else None
        rows = fallback.rows if fallback is not None else default_rows()
        db.add(PayrollLayout(company_id=current_user.company_id, driver_type=driver_type, rows=rows, driver_order=order))
    else:
        layout.driver_order = order
    await db.commit()
    return {"driver_order": order}
