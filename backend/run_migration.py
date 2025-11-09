#!/usr/bin/env python3
import asyncio
import asyncpg

async def run_migration():
    # Database connection details
    conn = await asyncpg.connect(
        host='trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com',
        port=5432,
        user='tmsadmin',
        password='VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=',
        database='trucking_tms'
    )

    try:
        # Read the SQL file
        with open('create_driver_payroll_settings_table.sql', 'r') as f:
            sql = f.read()

        # Execute the SQL
        await conn.execute(sql)
        print("✓ driver_payroll_settings table created successfully")

        # Verify the table was created
        result = await conn.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'driver_payroll_settings'
            ORDER BY ordinal_position
        """)

        print("\nTable structure:")
        for row in result:
            print(f"  - {row['column_name']}: {row['data_type']}")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
