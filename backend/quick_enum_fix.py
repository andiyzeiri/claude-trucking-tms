#!/usr/bin/env python3
"""Quick fix for enum type"""
import asyncio
import asyncpg

async def fix():
    conn = await asyncpg.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )

    try:
        # Check if loadstatus enum exists
        result = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loadstatus')")

        if not result:
            print("Creating loadstatus enum...")
            await conn.execute("DROP TYPE IF EXISTS load_status CASCADE")
            await conn.execute("CREATE TYPE loadstatus AS ENUM ('available', 'dispatched', 'invoiced')")
            await conn.execute("ALTER TABLE loads ALTER COLUMN status TYPE loadstatus USING status::text::loadstatus")
            print("✅ loadstatus enum created!")
        else:
            print("✅ loadstatus enum already exists")

    finally:
        await conn.close()

asyncio.run(fix())
