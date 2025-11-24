#!/usr/bin/env python3
"""
Reset production database - DROP ALL TABLES and run fresh migrations
"""
import asyncio
import asyncpg
import os
import sys

DB_HOST = "andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_USER = "anditms"
DB_PASSWORD = "AndiTMS2024Pass"
DB_NAME = "anditms"


async def reset_database():
    """Drop all tables and extensions"""
    print("🔄 Connecting to production database...")

    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )

        print("✅ Connected successfully\n")

        # Get all tables
        tables = await conn.fetch("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
        """)

        if tables:
            print(f"📋 Found {len(tables)} tables to drop:")
            for table in tables:
                print(f"  - {table['tablename']}")

            print("\n⚠️  WARNING: This will delete ALL data!")
            print("Proceeding in 3 seconds...")
            await asyncio.sleep(3)

            # Drop all tables
            print("\n🗑️  Dropping all tables...")
            for table in tables:
                await conn.execute(f'DROP TABLE IF EXISTS "{table["tablename"]}" CASCADE')
                print(f"  ✓ Dropped {table['tablename']}")

            print("\n✅ All tables dropped!")
        else:
            print("ℹ️  No tables found")

        # Drop alembic version table if exists
        await conn.execute('DROP TABLE IF EXISTS alembic_version CASCADE')
        print("✓ Dropped alembic_version table")

        # Drop PostGIS extension if exists (will be recreated by migrations if needed)
        try:
            await conn.execute('DROP EXTENSION IF EXISTS postgis CASCADE')
            print("✓ Dropped PostGIS extension")
        except Exception as e:
            print(f"ℹ️  PostGIS not installed or already dropped: {e}")

        await conn.close()
        print("\n✅ Database reset complete! Ready for migrations.")
        return 0

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(reset_database())
    sys.exit(exit_code)
