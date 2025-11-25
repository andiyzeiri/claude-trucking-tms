#!/usr/bin/env python3
"""
Fix trucks table:
1. Add value, miles, mpg columns
2. Drop unique constraint on truck_number (allow same number for truck and trailer)
3. Drop unique constraint on vin (allow duplicates)
"""

import asyncio
import asyncpg
import os


async def main():
    # Get database URL from environment
    db_url = os.environ.get("DATABASE_URL", "")

    if not db_url:
        # Try to construct from individual vars
        db_host = os.environ.get("DB_HOST", "localhost")
        db_port = os.environ.get("DB_PORT", "5432")
        db_name = os.environ.get("DB_NAME", "trucking_tms")
        db_user = os.environ.get("DB_USER", "postgres")
        db_password = os.environ.get("DB_PASSWORD", "postgres")
        db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    # Remove asyncpg prefix if present
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("\n1. Adding value column to trucks table...")
        try:
            await conn.execute("""
                ALTER TABLE trucks ADD COLUMN IF NOT EXISTS value NUMERIC(12, 2) DEFAULT 0;
            """)
            print("   ✓ Added value column")
        except Exception as e:
            print(f"   ⚠ Value column: {e}")

        print("\n2. Adding miles column to trucks table...")
        try:
            await conn.execute("""
                ALTER TABLE trucks ADD COLUMN IF NOT EXISTS miles INTEGER DEFAULT 0;
            """)
            print("   ✓ Added miles column")
        except Exception as e:
            print(f"   ⚠ Miles column: {e}")

        print("\n3. Adding mpg column to trucks table...")
        try:
            await conn.execute("""
                ALTER TABLE trucks ADD COLUMN IF NOT EXISTS mpg NUMERIC(5, 1) DEFAULT 0;
            """)
            print("   ✓ Added mpg column")
        except Exception as e:
            print(f"   ⚠ MPG column: {e}")

        print("\n4. Dropping unique constraint on truck_number...")
        try:
            # Find and drop the unique constraint on truck_number
            constraints = await conn.fetch("""
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'trucks'::regclass
                AND contype = 'u'
                AND conname LIKE '%truck_number%'
            """)
            for constraint in constraints:
                await conn.execute(f"ALTER TABLE trucks DROP CONSTRAINT IF EXISTS {constraint['conname']}")
                print(f"   ✓ Dropped constraint: {constraint['conname']}")

            if not constraints:
                # Try dropping index instead
                await conn.execute("DROP INDEX IF EXISTS trucks_truck_number_key")
                print("   ✓ Dropped index: trucks_truck_number_key")
        except Exception as e:
            print(f"   ⚠ Truck number constraint: {e}")

        print("\n5. Dropping unique constraint on vin...")
        try:
            # Find and drop the unique constraint on vin
            constraints = await conn.fetch("""
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'trucks'::regclass
                AND contype = 'u'
                AND conname LIKE '%vin%'
            """)
            for constraint in constraints:
                await conn.execute(f"ALTER TABLE trucks DROP CONSTRAINT IF EXISTS {constraint['conname']}")
                print(f"   ✓ Dropped constraint: {constraint['conname']}")

            if not constraints:
                # Try dropping index instead
                await conn.execute("DROP INDEX IF EXISTS trucks_vin_key")
                print("   ✓ Dropped index: trucks_vin_key")
        except Exception as e:
            print(f"   ⚠ VIN constraint: {e}")

        print("\n6. Creating composite unique constraint (type + truck_number + company_id)...")
        try:
            await conn.execute("""
                ALTER TABLE trucks
                ADD CONSTRAINT trucks_type_number_company_unique
                UNIQUE (type, truck_number, company_id)
            """)
            print("   ✓ Created composite unique constraint")
        except Exception as e:
            if "already exists" in str(e):
                print("   ✓ Composite unique constraint already exists")
            else:
                print(f"   ⚠ Composite constraint: {e}")

        await conn.close()
        print("\n✓ Database migration complete!")

    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
