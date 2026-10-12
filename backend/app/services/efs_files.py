"""
Parse WEX / EFS "Fuel/Cash Transaction File" reports (spec: "EFS Fuel/Cash
Transaction File Format - October 2024").

Fixed-length formats (110, 114, 119...) and CSV formats (111, 115...) share
the same records, grouped per transaction:
  HH file header
  TA transaction summary   - id, card, date/time, credit flag
  TL line (one per product)- category, quantity, discounted amount, fuel use
  TX line tax              - ignored
  LL location              - name, city, state
  TI info (prompts keyed)  - UNIT, ODRD odometer, DRID, NAME...
  MI / TM misc / meta      - ignored
  TT transaction trailer   - sign and total
  HT file trailer
Fixed-length positions below are the spec's 1-based Start..End columns.
Amounts in fixed-length files are absolute; a credit/void is flagged by
TA "Is Credit" = 'C' or a '-' sign on TT, and is returned negative.
"""

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional

CENT = Decimal("0.01")

# DEF is "considered a fuel product" (spec 3.3) but has fuel use 0, so go by code.
DEF_CODES = {"DEFD", "DEF", "UREA"}
TRACTOR_FUEL_USE = "1"  # TL Fuel Use Type: 0 non-fuel, 1 fuel, 2 reefer
FALLBACK_FUEL_CODES = {"ULSD", "FUEL", "DSL1", "BDSL", "CDSL"}  # if fuel use is blank


@dataclass
class CardTransaction:
    transaction_id: str
    transaction_date: Optional[datetime]
    card_last6: str
    unit: Optional[str] = None
    driver_prompt: Optional[str] = None
    odometer: Optional[int] = None
    location: str = ""
    state: Optional[str] = None
    is_credit: bool = False
    fuel_gallons: Decimal = Decimal(0)
    fuel_amount: Decimal = Decimal(0)
    def_gallons: Decimal = Decimal(0)
    def_amount: Decimal = Decimal(0)
    other_amount: Decimal = Decimal(0)
    other_items: List[str] = field(default_factory=list)
    net_total: Decimal = Decimal(0)
    _loc: Dict[str, str] = field(default_factory=dict, repr=False)
    _infos: Dict[str, str] = field(default_factory=dict, repr=False)


def _cut(line: str, start: int, end: int) -> str:
    """Spec columns are 1-based and inclusive."""
    return line[start - 1:end].strip()


def _implied(raw: str, places: int) -> Decimal:
    digits = re.sub(r"[^0-9]", "", raw or "")
    if not digits:
        return Decimal(0)
    return (Decimal(digits) / (Decimal(10) ** places)).quantize(Decimal(1).scaleb(-places))


def _dec(raw: str) -> Decimal:
    try:
        return Decimal((raw or "0").strip() or "0")
    except InvalidOperation:
        return Decimal(0)


def _when(raw: str) -> Optional[datetime]:
    raw = (raw or "").strip()
    for fmt in ("%Y%m%d%H%M", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y%m%d%H%M%S", "%Y%m%d"):
        try:
            return datetime.strptime(raw[:len(datetime.now().strftime(fmt))], fmt)
        except ValueError:
            continue
    return None


def _add_line(tx: CardTransaction, code: str, qty: Decimal, amount: Decimal, fuel_use: str) -> None:
    code = code.upper()
    if code in DEF_CODES:
        tx.def_gallons += qty
        tx.def_amount += amount
    elif fuel_use.lstrip("0") == TRACTOR_FUEL_USE or (not fuel_use.strip("0") and code in FALLBACK_FUEL_CODES):
        tx.fuel_gallons += qty
        tx.fuel_amount += amount
    elif amount or qty:
        tx.other_amount += amount
        tx.other_items.append(f"{code or 'OTHER'} ${amount}")


def _finish(tx: CardTransaction, sign: str, total: Decimal) -> CardTransaction:
    if sign == "-":
        tx.is_credit = True
    tx.net_total = total
    if tx.is_credit:  # credits/voids come through as absolute values
        for name in ("fuel_gallons", "fuel_amount", "def_gallons", "def_amount", "other_amount", "net_total"):
            value = getattr(tx, name)
            setattr(tx, name, -abs(value))
    name, city, state = tx._loc.get("name"), tx._loc.get("city"), tx._loc.get("state")
    tx.location = ", ".join(x for x in (name, city, state) if x)[:255]
    tx.state = state or None
    infos = tx._infos
    tx.unit = infos.get("UNIT") or infos.get("VEHN")
    tx.driver_prompt = infos.get("DRID") or infos.get("NAME")
    odo = re.sub(r"[^0-9]", "", infos.get("ODRD") or infos.get("HBRD") or "")
    tx.odometer = int(odo) if odo and int(odo) > 0 else None
    return tx


def _parse_fixed(lines: List[str]) -> List[CardTransaction]:
    out: List[CardTransaction] = []
    tx: Optional[CardTransaction] = None
    for line in lines:
        rec = line[:2]
        if rec == "TA":
            card = _cut(line, 25, 49)
            tx = CardTransaction(
                transaction_id=_cut(line, 15, 24).lstrip("0") or "0",
                transaction_date=_when(_cut(line, 72, 83)),
                card_last6=re.sub(r"[^0-9]", "", card)[-6:],
                is_credit=_cut(line, 259, 259).upper() == "C",
            )
        elif tx is None:
            continue
        elif rec == "TL":
            _add_line(tx, _cut(line, 27, 30), _implied(_cut(line, 31, 37), 2),
                      _implied(_cut(line, 38, 48), 2), _cut(line, 70, 71))
        elif rec == "LL":
            tx._loc = {"name": _cut(line, 29, 53), "city": _cut(line, 54, 78), "state": _cut(line, 79, 80)}
        elif rec == "TI":
            code, value = _cut(line, 25, 28).upper(), _cut(line, 29, 53)
            if code and value and code not in tx._infos:
                tx._infos[code] = value
        elif rec == "TT":
            out.append(_finish(tx, _cut(line, 35, 35), _implied(_cut(line, 36, 46), 2)))
            tx = None
    return out


def _parse_csv(text: str) -> List[CardTransaction]:
    out: List[CardTransaction] = []
    tx: Optional[CardTransaction] = None
    for row in csv.reader(io.StringIO(text)):
        if not row:
            continue
        row = [c.strip() for c in row] + [""] * 40
        rec = row[0].upper()
        if rec == "TA":
            tx = CardTransaction(
                transaction_id=row[3].lstrip("0") or "0",
                transaction_date=_when(row[7]),
                card_last6=re.sub(r"[^0-9]", "", row[4])[-6:],
                is_credit=row[30].upper() == "C",
            )
        elif tx is None:
            continue
        elif rec == "TL":
            _add_line(tx, row[5], abs(_dec(row[6])), abs(_dec(row[7])).quantize(CENT), row[11])
        elif rec == "LL":
            tx._loc = {"name": row[5], "city": row[6], "state": row[7]}
        elif rec == "TI":
            code, value = row[4].upper(), row[5]
            if code and value and code not in tx._infos:
                tx._infos[code] = value
        elif rec == "TT":
            out.append(_finish(tx, row[5], abs(_dec(row[6])).quantize(CENT)))
            tx = None
    return out


def parse_file(data: bytes) -> List[CardTransaction]:
    """All transactions in one EFS transaction file (fixed-length or CSV)."""
    text = data.decode("latin-1")
    lines = [ln.rstrip("\r\n") for ln in text.splitlines()]
    first = next((ln for ln in lines if ln.strip()), "")
    if not first.startswith("HH"):
        raise ValueError("Not an EFS transaction file (no HH header)")
    if first.startswith("HH,"):
        return _parse_csv(text)
    return _parse_fixed(lines)
