"""
Shippers and Receivers pages, filled from AI loads.

Each AI load's pickup company becomes a shipper and its delivery company a
receiver, with the address read off the rate confirmation. A place already
on the page (same name, city and state, ignoring punctuation and Inc/LLC-type
endings) is not added again; only its blank address fields are filled in.
"""
import logging
import re
from datetime import datetime, timedelta
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.models.receiver import Receiver
from app.models.shipper import Shipper

logger = logging.getLogger(__name__)

_SUFFIXES = {"INC", "LLC", "LTD", "CO", "CORP", "CORPORATION", "COMPANY", "INCORPORATED", "LP", "LLP", "THE"}
_ZIP = re.compile(r"\b(\d{5})(?:-\d{4})?\b")
_STATE_ZIP = re.compile(r"^([A-Za-z]{2})\b\s*(\d{5}(?:-\d{4})?)?$")


def _clean(v) -> Optional[str]:
    v = re.sub(r"\s+", " ", str(v or "")).strip(" ,")
    return v or None


def name_key(name) -> str:
    words = re.sub(r"[^A-Za-z0-9 ]", " ", str(name or "")).upper().split()
    return " ".join(w for w in words if w not in _SUFFIXES)


def place_key(name, city, state) -> tuple:
    return (name_key(name), re.sub(r"[^A-Z]", "", str(city or "").upper()), str(state or "").strip().upper()[:2])


def _field(extraction: dict, key: str) -> Optional[str]:
    f = (extraction or {}).get(key)
    return _clean(f.get("value") if isinstance(f, dict) else f)


def _parse_location(location) -> dict:
    """'street, city, ST zip' (the loads grid's format) or 'city, ST'."""
    parts = [p.strip() for p in str(location or "").split(",") if p.strip()]
    out = {}
    if parts:
        m = _STATE_ZIP.match(parts[-1])
        if m:
            out["state"] = m.group(1).upper()
            if m.group(2):
                out["zip_code"] = m.group(2)
            parts = parts[:-1]
    if parts:
        out["city"] = parts[-1]
        if len(parts) > 1:
            out["address"] = ", ".join(parts[:-1])
    return out


def places_of(doc: IngestedDocument) -> list:
    """[(Model, fields)] for an AI load's shipper and receiver."""
    draft = doc.draft if isinstance(doc.draft, dict) else {}
    ex = doc.extraction if isinstance(doc.extraction, dict) else {}
    out = []
    for model, name_field, loc_field, prefix, company in (
        (Shipper, "shipper_name", "pickup_location", "origin", "origin_company"),
        (Receiver, "receiver_name", "delivery_location", "destination", "destination_company"),
    ):
        name = _clean(draft.get(name_field)) or _field(ex, company)
        if not name:
            continue
        # The load's own (possibly hand-corrected) location first, then the rate con's fields.
        place = _parse_location(draft.get(loc_field))
        for key, col in (("street", "address"), ("city", "city"), ("state", "state"), ("zip", "zip_code")):
            place.setdefault(col, _field(ex, f"{prefix}_{key}"))
        if place.get("state"):
            place["state"] = place["state"].upper()[:2]
        if place.get("zip_code"):
            m = _ZIP.search(place["zip_code"])
            place["zip_code"] = m.group(1) if m else None
        if not place.get("city"):
            continue  # can't tell one location of a chain from another
        out.append((model, {"name": name[:255], **{k: v for k, v in place.items() if v}}))
    return out


async def sync_places(session: AsyncSession, company_id: int, docs: Iterable[IngestedDocument]) -> dict:
    """Add the loads' shippers/receivers that aren't on the pages yet. Returns counts."""
    stats = {"shippers": 0, "receivers": 0, "filled": 0}
    known = {}
    for model in (Shipper, Receiver):
        rows = (await session.execute(select(model).where(model.company_id == company_id))).scalars().all()
        known[model] = {place_key(r.name, r.city, r.state): r for r in rows}
    for doc in docs:
        for model, fields in places_of(doc):
            key = place_key(fields["name"], fields.get("city"), fields.get("state"))
            row = known[model].get(key)
            if row is not None:
                for col in ("address", "zip_code", "state"):
                    if fields.get(col) and not getattr(row, col):
                        setattr(row, col, fields[col])
                        stats["filled"] += 1
                continue
            row = model(company_id=company_id, **fields)
            session.add(row)
            known[model][key] = row
            stats["shippers" if model is Shipper else "receivers"] += 1
    await session.flush()
    return stats


async def sync_places_safely(session: AsyncSession, company_id: int, docs: Iterable[IngestedDocument]) -> None:
    """sync_places that never breaks the caller (load building / editing)."""
    try:
        async with session.begin_nested():
            stats = await sync_places(session, company_id, docs)
        if stats["shippers"] or stats["receivers"]:
            logger.info("loads-ai: added %s shipper(s), %s receiver(s) from loads", stats["shippers"], stats["receivers"])
    except Exception:
        logger.exception("loads-ai: could not update shippers/receivers")


async def backfill_places(session: AsyncSession, days: int = 365) -> dict:
    """Every company's AI loads of the last `days` days."""
    since = datetime.utcnow() - timedelta(days=days)
    docs = (
        await session.execute(
            select(IngestedDocument).where(
                IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
                IngestedDocument.draft.isnot(None),
                IngestedDocument.created_at >= since,
            ).order_by(IngestedDocument.created_at)
        )
    ).scalars().all()
    by_company = {}
    for d in docs:
        by_company.setdefault(d.company_id, []).append(d)
    total = {"shippers": 0, "receivers": 0, "filled": 0, "loads": len(docs)}
    for company_id, company_docs in by_company.items():
        stats = await sync_places(session, company_id, company_docs)
        for k in ("shippers", "receivers", "filled"):
            total[k] += stats[k]
    return total
