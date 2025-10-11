#!/usr/bin/env python3
import asyncio
import asyncpg
import os
import sys

async def run_migration():
    db_url = os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')

    try:
        conn = await asyncpg.connect(db_url)

        # Drop the unique constraint on load_number
        print("Removing unique constraint from loads.load_number...")
        await conn.execute("ALTER TABLE loads DROP CONSTRAINT IF EXISTS loads_load_number_key")

        # Drop the unique index on load_number
        print("Removing unique index from loads.load_number...")
        await conn.execute("DROP INDEX IF EXISTS ix_loads_load_number")

        # Recreate as a non-unique index
        print("Creating non-unique index on loads.load_number...")
        await conn.execute("CREATE INDEX IF NOT EXISTS ix_loads_load_number ON loads(load_number)")

        # Also allow NULL values
        print("Allowing NULL values for load_number...")
        await conn.execute("ALTER TABLE loads ALTER COLUMN load_number DROP NOT NULL")

        await conn.close()
        print("✅ Migration completed successfully!")
        return 0
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(run_migration())
    sys.exit(exit_code)
