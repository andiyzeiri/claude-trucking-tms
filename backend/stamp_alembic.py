#!/usr/bin/env python3
"""
Stamp Alembic version table to mark migrations as completed without running them
"""
import asyncio
import asyncpg
import os
import sys


async def stamp_migrations():
    """Stamp Alembic version table"""
    # Get database URL from environment
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Stamping Alembic migrations...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")

        # Create alembic_version table if it doesn't exist
        print("🔧 Ensuring alembic_version table exists...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(32) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            )
        """)

        # Check if there's already a version
        existing = await conn.fetchval("SELECT version_num FROM alembic_version")
        if existing:
            print(f"⚠️  Current version: {existing}")
            # Delete existing version
            await conn.execute("DELETE FROM alembic_version")

        # Insert the latest version (our new migration)
        print("🔧 Stamping with version 33dd72b7f145...")
        await conn.execute(
            "INSERT INTO alembic_version (version_num) VALUES ($1)",
            '33dd72b7f145'
        )

        print("✅ Successfully stamped migrations!")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(stamp_migrations())
    sys.exit(exit_code)
