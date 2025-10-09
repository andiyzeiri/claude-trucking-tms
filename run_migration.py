import asyncio
import asyncpg
import os
import sys

async def run_migration():
    # Get database URL from environment
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    # Convert SQLAlchemy URL to asyncpg URL
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print(f"Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("Adding pod_url column...")
        await conn.execute("ALTER TABLE loads ADD COLUMN IF NOT EXISTS pod_url VARCHAR")

        print("Adding ratecon_url column...")
        await conn.execute("ALTER TABLE loads ADD COLUMN IF NOT EXISTS ratecon_url VARCHAR")

        print("✅ Migration completed successfully!")

        await conn.close()

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_migration())
