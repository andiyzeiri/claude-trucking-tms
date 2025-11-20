#!/usr/bin/env python3
"""
Add missing columns to users table
"""
import asyncio
import asyncpg
import os
import sys


async def run_migration():
    """Add missing columns to users table"""
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Starting users table migration...")
    print(f"📍 Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")

        # Add missing columns
        print("🔧 Adding username column...")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)")

        print("🔧 Adding is_superuser column...")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT false")

        print("🔧 Adding email_verified column...")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false")

        print("🔧 Adding email_verified_at column...")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE")

        print("🔧 Adding page_permissions column...")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS page_permissions JSONB")

        print("🔧 Adding company_id column...")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID")

        # Rename password_hash to hashed_password if needed
        print("🔧 Checking password column name...")
        try:
            await conn.execute("ALTER TABLE users RENAME COLUMN password_hash TO hashed_password")
            print("✅ Renamed password_hash to hashed_password")
        except Exception:
            print("⚠️  Column already renamed or doesn't exist, skipping...")

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
