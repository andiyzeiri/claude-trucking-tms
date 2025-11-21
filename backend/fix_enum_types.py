#!/usr/bin/env python3
"""Fix enum types in production database"""
import asyncio
import asyncpg
import os
import sys


async def fix_enums():
    """Create missing enum types"""
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Fixing enum types...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")

        # Check if loadstatus enum exists
        result = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'loadstatus'
            )
        """)

        if not result:
            print("🔧 Creating loadstatus enum...")
            # Drop the old load_status enum if it exists
            await conn.execute("DROP TYPE IF EXISTS load_status CASCADE;")
            # Create the correct enum type
            await conn.execute("""
                CREATE TYPE loadstatus AS ENUM ('available', 'dispatched', 'invoiced');
            """)
            # Update the loads table to use the new enum
            await conn.execute("""
                ALTER TABLE loads
                ALTER COLUMN status TYPE loadstatus
                USING status::text::loadstatus;
            """)
            print("✓ Created loadstatus enum")
        else:
            print("✓ loadstatus enum already exists")

        print("✅ Enum fixes completed successfully!")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(fix_enums())
    sys.exit(exit_code)
