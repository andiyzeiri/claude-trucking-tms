#!/usr/bin/env python3
"""
Add loads.broker_load_number / bol_number / po_number plus the per-tenant
lookup indexes used by document matching.

reference_number historically carried all three identifiers at once, so a
rate confirmation yielded three and the TMS kept one. Keeping them distinct
is what lets a document be matched on an exact identifier instead of on
fuzzy signals like city and date.

Indexes are composite on (company_id, lower(col)) because every matching
query is tenant-scoped and compares case-insensitively.

Idempotent: safe to run on every container start.
"""

import asyncio
import json
import os

COLUMNS = ("broker_load_number", "bol_number", "po_number")

# (index name, table expression). lower() so lookups are case-insensitive;
# load_number gets one too since it is the strongest matching key.
INDEXES = [
    (f"ix_loads_company_{col}", f"(company_id, lower({col}))")
    for col in COLUMNS
] + [
    ("ix_loads_company_load_number_lower", "(company_id, lower(load_number))"),
    ("ix_loads_company_reference_number_lower", "(company_id, lower(reference_number))"),
]


async def add_load_identifier_columns():
    import asyncpg

    db_secret = os.environ.get("DATABASE_SECRET_JSON")
    if db_secret:
        secret = json.loads(db_secret)
        db_url = (
            f"postgresql://{secret['username']}:{secret['password']}"
            f"@{secret['host']}:{secret.get('port', 5432)}/{secret['dbname']}"
        )
    else:
        db_url = os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")

    if not db_url:
        print("No database URL found, skipping...")
        return

    print("🔧 Adding broker/BOL/PO identifier columns to loads...")
    conn = await asyncpg.connect(db_url)

    try:
        for col in COLUMNS:
            await conn.execute(f"""
                ALTER TABLE loads ADD COLUMN IF NOT EXISTS {col} VARCHAR
            """)
            print(f"   ✓ loads.{col}")

        for name, expr in INDEXES:
            await conn.execute(f"""
                CREATE INDEX IF NOT EXISTS {name} ON loads {expr}
            """)
            print(f"   ✓ index {name}")

        # No backfill from reference_number on purpose. That column has been
        # carrying whichever identifier the dispatcher had to hand - broker
        # load number on some rows, BOL or PO on others - so copying it into
        # broker_load_number would assert a type it does not actually have.
        # The new columns start empty and get populated going forward.
        print("✓ load identifier columns ready (existing rows left untouched)")
    except Exception as e:
        print(f"⚠️ Error adding load identifier columns: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(add_load_identifier_columns())
