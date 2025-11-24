#!/usr/bin/env python3
"""
Check production database schema
"""
import asyncio
import asyncpg

DB_HOST = "andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_USER = "anditms"
DB_PASSWORD = "AndiTMS2024Pass"
DB_NAME = "anditms"


async def check_schema():
    """Check database schema"""
    print("🔍 Checking production database schema...")

    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )

        print("✅ Connected\n")

        # Get all tables
        tables = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)

        print(f"=== TABLES ({len(tables)} found) ===")
        for table in tables:
            print(f"  - {table['table_name']}")

        # Check users table structure
        print("\n=== USERS TABLE STRUCTURE ===")
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        """)

        for col in columns:
            print(f"  {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")

        # Get a sample user
        print("\n=== SAMPLE USER ===")
        user = await conn.fetchrow("SELECT * FROM users LIMIT 1")
        if user:
            for key, value in dict(user).items():
                print(f"  {key}: {value} (type: {type(value).__name__})")

        await conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(check_schema())
