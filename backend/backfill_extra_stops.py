#!/usr/bin/env python3
"""
Multi-stop Amazon (Golden Arcus) AI loads built before extra stops existed:
show their earlier deliveries as extra stops (draft["extra_stops"]) from the
appointments already kept in draft["stops"]. Only loads with no extra_stops
yet are touched, so stops edited on the page are never overwritten. Idempotent.
"""
import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

LIVE = ["ai_load", "load_created", "needs_review", "extracted"]


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
        rows = (await conn.execute(text(
            "SELECT id, draft FROM ingested_documents "
            "WHERE status = ANY(:live) AND jsonb_typeof(draft->'stops') = 'array' "
            "AND jsonb_array_length(draft->'stops') > 1 AND NOT (draft ? 'extra_stops')"
        ), {"live": LIVE})).all()
        for doc_id, draft in rows:
            draft = dict(draft)
            draft["extra_stops"] = [
                {"type": "delivery", "location": s.get("location"), "date": s.get("date"),
                 "name": s.get("name"), "appointment": s.get("appointment")}
                for s in draft["stops"][:-1] if isinstance(s, dict) and s.get("location")
            ]
            await conn.execute(text("UPDATE ingested_documents SET draft = CAST(:d AS jsonb) WHERE id = :id"),
                               {"d": json.dumps(draft), "id": doc_id})
        print(f"extra stops: {len(rows)} multi-stop AI load(s) now show their extra stops")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
