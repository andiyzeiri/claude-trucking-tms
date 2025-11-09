import asyncio
import asyncpg
import os


async def run_migration():
    """Run the driver_payroll_settings table migration."""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        return

    print("Connecting to database...")
    conn = await asyncpg.connect(database_url)

    try:
        print("Running driver_payroll_settings migration...")

        # Read the SQL file
        with open('create_driver_payroll_settings.sql', 'r') as f:
            sql = f.read()

        # Execute the migration
        await conn.execute(sql)

        print("✓ Migration completed successfully!")
        print("✓ Created driver_payroll_settings table")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
