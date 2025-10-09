import asyncio
import asyncpg
import os

async def run_migration():
    # Get database URL from environment
    db_url = os.environ.get('DATABASE_URL', '')
    
    if not db_url:
        print("DATABASE_URL not set")
        return
    
    # Parse connection string
    # Format: postgresql+asyncpg://user:pass@host:port/dbname
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"Connecting to database...")
    
    conn = await asyncpg.connect(db_url)
    
    try:
        # Add the missing columns
        print("Adding pod_url column...")
        await conn.execute("ALTER TABLE loads ADD COLUMN IF NOT EXISTS pod_url VARCHAR")
        
        print("Adding ratecon_url column...")
        await conn.execute("ALTER TABLE loads ADD COLUMN IF NOT EXISTS ratecon_url VARCHAR")
        
        print("Migration completed successfully!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
