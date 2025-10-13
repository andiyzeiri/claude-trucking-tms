import asyncio
import asyncpg

async def run_migration():
    conn = await asyncpg.connect(
        host='trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com',
        port=5432,
        user='tmsadmin',
        password='VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=',
        database='trucking_tms'
    )

    try:
        # Read migration SQL
        with open('add_carrier_rate_and_notes.sql', 'r') as f:
            sql = f.read()

        # Execute migration
        await conn.execute(sql)
        print("✅ Migration completed successfully!")
        print("Added columns: carrier_rate, pickup_notes, delivery_notes")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(run_migration())
