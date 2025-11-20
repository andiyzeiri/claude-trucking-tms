#!/usr/bin/env python3
"""
Initialize database schema if it doesn't exist
"""
import asyncio
import asyncpg
import os
import sys


async def init_schema():
    """Initialize database schema from schema.sql if tables don't exist"""
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔍 Checking if database schema exists...")

    try:
        conn = await asyncpg.connect(db_url)

        # Check if loads table exists
        result = await conn.fetchval(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loads')"
        )

        if result:
            print("✅ Database schema already exists. Skipping initialization.")
            await conn.close()
            return 0

        print("📦 Initializing database schema...")

        # Read schema file
        schema_path = '/app/schema.sql'
        if not os.path.exists(schema_path):
            print(f"⚠️  Schema file not found at {schema_path}, skipping schema init")
            await conn.close()
            return 0

        with open(schema_path, 'r') as f:
            schema_sql = f.read()

        # Execute schema
        await conn.execute(schema_sql)

        print("✅ Database schema initialized successfully!")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Schema initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(init_schema())
    sys.exit(exit_code)
