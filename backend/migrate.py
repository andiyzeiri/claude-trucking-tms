#!/usr/bin/env python3
"""
Database migration script to add missing columns
"""
import asyncio
import asyncpg
import os
import sys


async def run_migration():
    """Add pod_url and ratecon_url columns to loads table"""
    # Get database URL from environment
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Starting database migration...")
    print(f"📍 Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")
        print("🔧 Adding pod_url column to loads table...")
        await conn.execute("ALTER TABLE loads ADD COLUMN IF NOT EXISTS pod_url VARCHAR")

        print("🔧 Adding ratecon_url column to loads table...")
        await conn.execute("ALTER TABLE loads ADD COLUMN IF NOT EXISTS ratecon_url VARCHAR")

        print("✅ Migration completed successfully!")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_migration())
    sys.exit(exit_code)
