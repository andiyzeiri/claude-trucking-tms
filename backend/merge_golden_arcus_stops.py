#!/usr/bin/env python3
"""
One-time: Golden Arcus emails read before multi-stop Amazon loads existed
built one AI load per Amazon appointment (e.g. IGQ2 and MDW2 from the same
email as two loads). Merge each email's loads into its first one: the others
become delivery stops on it (shown as extra stops, Notes listing every
appointment ID) and are filed as stop_added, never deleted.

An email's loads are left alone when any load after the first already has a
driver, a rate, or is dispatched / invoiced (someone is working them as
separate loads), or when the loads have different pickups. Idempotent:
merged loads are no longer live AI loads.
"""
import asyncio
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib  # noqa: E402
import pkgutil  # noqa: E402

import app.models  # noqa: E402
for _m in pkgutil.iter_modules(app.models.__path__):  # every mapper, for the session
    importlib.import_module(f"app.models.{_m.name}")
from sqlalchemy import select  # noqa: E402
from app.database import AsyncSessionLocal  # noqa: E402
from app.documents import amazon_stops, extra_stops  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, DocumentStatus, IngestedDocument  # noqa: E402

GOLDEN_ARCUS = re.compile(r"golden\s+arcus", re.I)


def _extracted(doc, key):
    f = (doc.extraction or {}).get(key) if isinstance(doc.extraction, dict) else None
    return f.get("value") if isinstance(f, dict) else f


def is_golden_arcus(doc, ga_ids) -> bool:
    d = doc.draft or {}
    if d.get("customer_id") in ga_ids:
        return True
    names = [d.get("shipper_name"), d.get("broker_name"), _extracted(doc, "origin_company"), _extracted(doc, "broker_name")]
    return any(n and GOLDEN_ARCUS.search(str(n)) for n in names)


def pickup_key(draft) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(draft.get("pickup_location") or "").upper())


def in_use(draft) -> bool:
    return bool(draft.get("driver_id") or draft.get("rate") or draft.get("dispatched") or draft.get("invoiced"))


async def main():
    async with AsyncSessionLocal() as session:
        ga_ids = set((await session.execute(select(Customer.id).where(Customer.name.ilike("%golden arcus%")))).scalars())
        docs = (await session.execute(
            select(IngestedDocument).where(
                IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
                IngestedDocument.inbound_email_id.isnot(None),
                IngestedDocument.draft.isnot(None),
            ).order_by(IngestedDocument.id)
        )).scalars().all()
        by_email = defaultdict(list)
        for d in docs:
            if isinstance(d.draft, dict) and is_golden_arcus(d, ga_ids):
                by_email[(d.company_id, d.inbound_email_id)].append(d)
        merged = 0
        for group in by_email.values():
            if len(group) < 2:
                continue
            # The earliest delivery keeps the load; the rest become its stops.
            group.sort(key=lambda d: (str(d.draft.get("delivery_date") or "9999"), d.id))
            target, rest = group[0], group[1:]
            labels = ", ".join(f"#{d.id}" for d in group)
            pickups = {pickup_key(d.draft) for d in group} - {""}
            if len(pickups) > 1:
                print(f"golden arcus stops: {labels} left separate - different pickups")
                continue
            if any(in_use(d.draft) for d in rest):
                print(f"golden arcus stops: {labels} left separate - a later load already has a driver, rate or is dispatched")
                continue
            for d in rest:
                target.draft = await amazon_stops.add_stop(target, d.draft)
                d.status = DocumentStatus.STOP_ADDED
                label = target.draft.get("broker_load_number") or target.draft.get("load_number") or f"#{target.id}"
                d.warnings = [f"Added as a stop on load {label} (same email)."]
            draft = dict(target.draft)
            draft["amazon_appointment"] = True
            draft["extra_stops"] = extra_stops.from_amazon_stops(draft.get("stops") or [])
            draft["appt_notes_fixed"] = True
            target.draft = draft
            merged += 1
            print(f"golden arcus stops: {labels} -> one load #{target.id} with {len(rest) + 1} deliveries")
        await session.commit()
        print(f"golden arcus stops: {merged} email(s) merged into multi-stop loads")


if __name__ == "__main__":
    asyncio.run(main())
