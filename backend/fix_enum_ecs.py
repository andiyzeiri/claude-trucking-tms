#!/usr/bin/env python3
"""Fix enum type - designed to run in ECS"""
import asyncio
import asyncpg
import os

async def fix():
    db_url = os.environ.get('DATABASE_URL', 'postgresql://anditms:AndiTMS2024Pass@andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/anditms')
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Connecting to database...")
    conn = await asyncpg.connect(db_url)

    try:
        print("🔧 Checking loadstatus enum...")
        exists = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loadstatus')")

        if not exists:
            print("🔧 Dropping old load_status enum...")
            await conn.execute("DROP TYPE IF EXISTS load_status CASCADE")

            print("🔧 Creating loadstatus enum...")
            await conn.execute("CREATE TYPE loadstatus AS ENUM ('available', 'dispatched', 'invoiced')")

            print("🔧 Updating loads table...")
            await conn.execute("ALTER TABLE loads ALTER COLUMN status TYPE loadstatus USING status::text::loadstatus")

            print("✅ Enum fix completed!")
        else:
            print("✅ loadstatus enum already exists")

        # Fix trucks.type column
        print("🔧 Fixing trucks.type column...")
        try:
            await conn.execute("ALTER TABLE trucks ALTER COLUMN type DROP DEFAULT")
            print("✓ Dropped default on trucks.type")
            await conn.execute("ALTER TABLE trucks ALTER COLUMN type TYPE trucktype USING type::text::trucktype")
            print("✅ Fixed trucks.type column to use trucktype enum")
        except Exception as e:
            print(f"⚠️  trucks.type fix: {e}")

    finally:
        await conn.close()
        print("🏁 Done!")

if __name__ == "__main__":
    asyncio.run(fix())
