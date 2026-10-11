"""
Payroll page rows, per company: which line items show, in what order, and
how each is filled (see app/models/payroll_layout.py).

The built-in rows always exist (they can be hidden, not deleted) and keep
their key, kind and - except where switching makes sense - their mode, so a
bad request can't turn Fuel into an earning or make Gross "fixed".
"""

import re
import uuid
from typing import Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.database import get_db
from app.models.payroll_layout import PayrollLayout
from app.models.user import User

router = APIRouter()

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
    # Built-in rows can be hidden but never dropped.
    for b in default_rows():
        if b["key"] not in seen:
            out.append({**b, "hidden": True})
    return out


async def _get(db: AsyncSession, company_id: int):
    return (
        await db.execute(select(PayrollLayout).where(PayrollLayout.company_id == company_id))
    ).scalar_one_or_none()


@router.get("/", response_model=Layout)
async def get_layout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    layout = await _get(db, current_user.company_id)
    if layout is None:
        return {"rows": default_rows()}
    # Re-normalize so rows saved before a new built-in existed pick it up.
    return {"rows": normalize([LayoutRow(**r) for r in layout.rows])}


@router.put("/", response_model=Layout)
async def save_layout(
    body: Layout,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rows = normalize(body.rows)
    layout = await _get(db, current_user.company_id)
    if layout is None:
        db.add(PayrollLayout(company_id=current_user.company_id, rows=rows))
    else:
        layout.rows = rows
    await db.commit()
    return {"rows": rows}
