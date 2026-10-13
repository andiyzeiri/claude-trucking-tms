#!/usr/bin/env python3
"""Shippers / Receivers pages: add the pickup and delivery companies of the last year's AI loads.
Places already on the pages (same name, city, state) are not added again. Runs once (marker in
one_time_jobs), so places deleted from the pages afterwards stay deleted."""
import asyncio
import importlib
import pkgutil

import app.models as models_pkg

for m in pkgutil.iter_modules(models_pkg.__path__):
    importlib.import_module(f"app.models.{m.name}")

from sqlalchemy import text  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.documents.facilities import backfill_places  # noqa: E402


JOB = "backfill_shippers_receivers_2026_10"


async def main():
    async with AsyncSessionLocal() as session:
        await session.execute(text("CREATE TABLE IF NOT EXISTS one_time_jobs (name VARCHAR(100) PRIMARY KEY, ran_at TIMESTAMP DEFAULT NOW())"))
        await session.commit()
        if (await session.execute(text("SELECT 1 FROM one_time_jobs WHERE name = :n"), {"n": JOB})).first():
            print("shippers/receivers backfill: already done")
            return
        stats = await backfill_places(session, days=365)
        await session.execute(text("INSERT INTO one_time_jobs (name) VALUES (:n)"), {"n": JOB})
        await session.commit()
    print(f"shippers/receivers from {stats['loads']} AI loads: {stats['shippers']} shipper(s), "
          f"{stats['receivers']} receiver(s) added, {stats['filled']} blank field(s) filled")


if __name__ == "__main__":
    asyncio.run(main())
