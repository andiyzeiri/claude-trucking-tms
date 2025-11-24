"""
Add def_gallons and def_price columns to fuel table
"""
import asyncio
import asyncpg
from app.config import settings

async def add_fuel_def_columns():
    """Add DEF (Diesel Exhaust Fluid) columns to fuel table"""

    # Parse database URL
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(db_url)

    try:
        # Check if def_gallons column exists
        result = await conn.fetchval("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'fuel' AND column_name = 'def_gallons'
        """)

        if result == 0:
            print("Adding def_gallons column to fuel table...")
            await conn.execute("""
                ALTER TABLE fuel
                ADD COLUMN IF NOT EXISTS def_gallons NUMERIC(10, 2)
            """)
            print("✓ Added def_gallons column")
        else:
            print("✓ def_gallons column already exists")

        # Check if def_price column exists
        result = await conn.fetchval("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'fuel' AND column_name = 'def_price'
        """)

        if result == 0:
            print("Adding def_price column to fuel table...")
            await conn.execute("""
                ALTER TABLE fuel
                ADD COLUMN IF NOT EXISTS def_price NUMERIC(10, 2)
            """)
            print("✓ Added def_price column")
        else:
            print("✓ def_price column already exists")

        print("✓ Fuel DEF columns migration completed successfully")

    except Exception as e:
        print(f"⚠️ Warning during fuel DEF columns migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(add_fuel_def_columns())
