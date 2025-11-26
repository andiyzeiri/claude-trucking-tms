#!/usr/bin/env python3
"""Add user_id column to drivers table for linking driver accounts"""
import asyncio
import asyncpg


async def fix_schema():
    """Add user_id column to drivers table"""

    # Connection string for production
    conn = await asyncpg.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )

    try:
        print("Adding user_id column to drivers table...")
        await conn.execute("""
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) UNIQUE;
        """)
        print("✓ Added user_id column to drivers table")

        # Create index for faster lookups
        print("Creating index on user_id...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
        """)
        print("✓ Created index on user_id")

        print("\n✅ Driver-user link schema update complete!")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(fix_schema())
