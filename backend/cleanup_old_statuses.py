#!/usr/bin/env python3
import asyncio
import asyncpg
import os
import sys

async def run_cleanup():
    db_url = os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')

    try:
        conn = await asyncpg.connect(db_url)

        print("Cleaning up old status values in database...")

        # Get count of loads with old statuses
        count = await conn.fetchval("""
            SELECT COUNT(*) FROM loads 
            WHERE status::text IN ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 
                                    'pending', 'assigned', 'in_transit', 'delivered', 'cancelled')
        """)
        
        print(f"Found {count} loads with old status values")

        if count > 0:
            # Update all old statuses to new ones
            result = await conn.execute("""
                UPDATE loads
                SET status = CASE
                    WHEN UPPER(status::text) = 'PENDING' THEN 'available'::loadstatus
                    WHEN UPPER(status::text) = 'ASSIGNED' THEN 'dispatched'::loadstatus
                    WHEN UPPER(status::text) = 'IN_TRANSIT' THEN 'dispatched'::loadstatus
                    WHEN UPPER(status::text) = 'DELIVERED' THEN 'invoiced'::loadstatus
                    WHEN UPPER(status::text) = 'CANCELLED' THEN 'available'::loadstatus
                    ELSE status
                END
                WHERE UPPER(status::text) IN ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
            """)
            print(f"Updated loads: {result}")

        print("✅ Cleanup completed successfully!")

        await conn.close()
        return 0
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(run_cleanup())
    sys.exit(exit_code)
