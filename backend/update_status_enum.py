#!/usr/bin/env python3
import asyncio
import asyncpg
import os
import sys

async def run_migration():
    db_url = os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')

    try:
        conn = await asyncpg.connect(db_url)

        print("Updating LoadStatus enum...")

        # First, add the new enum values if they don't exist
        print("Adding new enum values...")
        await conn.execute("ALTER TYPE loadstatus ADD VALUE IF NOT EXISTS 'available'")
        await conn.execute("ALTER TYPE loadstatus ADD VALUE IF NOT EXISTS 'dispatched'")
        await conn.execute("ALTER TYPE loadstatus ADD VALUE IF NOT EXISTS 'invoiced'")

        print("New enum values added successfully")

        # Update existing data to use new statuses using raw string casts
        print("Migrating existing status values...")
        await conn.execute("""
            UPDATE loads
            SET status = CASE
                WHEN status::text = 'pending' THEN 'available'::loadstatus
                WHEN status::text = 'assigned' THEN 'dispatched'::loadstatus
                WHEN status::text = 'in_transit' THEN 'dispatched'::loadstatus
                WHEN status::text = 'delivered' THEN 'invoiced'::loadstatus
                WHEN status::text = 'cancelled' THEN 'available'::loadstatus
                ELSE status
            END
            WHERE status::text IN ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled')
        """)

        print("Existing data migrated successfully")

        await conn.close()
        print("✅ Migration completed successfully!")
        return 0
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(run_migration())
    sys.exit(exit_code)
