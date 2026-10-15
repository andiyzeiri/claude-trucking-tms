#!/usr/bin/env python3
"""
One-time: Notes on Golden Arcus AI loads built before Notes held only the
Amazon appointment ID(s) - e.g. "Appt# 139274008987" or, for
a multi-stop load, "Appt# 139274008987, 973274703".

Only AI loads built before CUTOFF are touched, and each once (marked
appt_notes_fixed), so notes typed later are never overwritten. Idempotent.
"""
import asyncio
import json
import os
import re
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

CUTOFF = datetime.fromisoformat("2026-10-15T14:30:00+00:00")  # after the notes fix deployed
LIVE = ("ai_load", "load_created", "needs_review", "extracted")
GOLDEN_ARCUS = re.compile(r"golden\s+arcus", re.I)


def _extracted(extraction, key):
    f = (extraction or {}).get(key)
    return f.get("value") if isinstance(f, dict) else f


def is_golden_arcus(draft, extraction, ga_customer_ids) -> bool:
    if draft.get("customer_id") in ga_customer_ids:
        return True
    names = [draft.get("shipper_name"), draft.get("broker_name"),
             _extracted(extraction, "origin_company"), _extracted(extraction, "broker_name")]
    return any(n and GOLDEN_ARCUS.search(str(n)) for n in names)


def appt_note(draft):
    """Same rule new loads use: each stop's appointment, else the load's own."""
    stops = draft.get("stops") or []
    ids = [str(s["appointment"]) for s in stops if isinstance(s, dict) and s.get("appointment")]
    if not ids:
        appt = draft.get("delivery_number") or draft.get("broker_load_number")
        ids = [str(appt)] if appt else []
    return "Appt# " + ", ".join(ids) if ids else None


async def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        secret = os.environ.get("DATABASE_SECRET_JSON")
        if not secret:
            print("No DATABASE_URL or DATABASE_SECRET_JSON found")
            return
        s = json.loads(secret)
        database_url = f"postgresql+asyncpg://{s['username']}:{s['password']}@{s['host']}:{s.get('port', 5432)}/{s['dbname']}"
    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        ga = {r[0] for r in (await conn.execute(text("SELECT id FROM customers WHERE name ILIKE '%golden arcus%'"))).all()}
        rows = (await conn.execute(text(
            "SELECT id, draft, extraction FROM ingested_documents "
            "WHERE status = ANY(:live) AND draft IS NOT NULL AND created_at < :cutoff "
            "AND NOT COALESCE((draft->>'appt_notes_fixed')::boolean, false)"
        ), {"live": list(LIVE), "cutoff": CUTOFF})).all()
        fixed = 0
        for doc_id, draft, extraction in rows:
            if not isinstance(draft, dict) or not is_golden_arcus(draft, extraction, ga):
                continue
            note = appt_note(draft)
            if not note:
                print(f"golden arcus notes: AI load {doc_id} has no appointment ID - left as is")
                continue
            draft = dict(draft)
            draft["pickup_notes"] = note
            draft.pop("notes", None)  # the page shows notes before pickup_notes
            draft["appt_notes_fixed"] = True
            await conn.execute(text("UPDATE ingested_documents SET draft = CAST(:d AS jsonb) WHERE id = :id"),
                               {"d": json.dumps(draft), "id": doc_id})
            fixed += 1
        print(f"golden arcus notes: {fixed} AI load(s) now hold only the appointment ID")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
