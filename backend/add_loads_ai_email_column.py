#!/usr/bin/env python3
"""
Add companies.loads_ai_source_email.

The mailbox that Loads AI draws loads from, stored per company so each
tenant points at its own intake address. Nullable - a company with no
value configured simply has no source yet.

Idempotent: safe to run on every container start.
"""

import asyncio
import json
import os


async def add_loads_ai_email_column():
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

    print("🔧 Adding loads_ai_source_email to companies...")
    conn = await asyncpg.connect(db_url)

    try:
        await conn.execute("""
            ALTER TABLE companies
            ADD COLUMN IF NOT EXISTS loads_ai_source_email VARCHAR
        """)
        # The driver POD inbox (pods@), shown next to the ratecons inbox.
        await conn.execute("""
            ALTER TABLE companies
            ADD COLUMN IF NOT EXISTS loads_ai_pod_email VARCHAR
        """)
        print("✓ companies.loads_ai_source_email / loads_ai_pod_email ready")
    except Exception as e:
        print(f"⚠️ Error adding loads_ai_source_email: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(add_loads_ai_email_column())
