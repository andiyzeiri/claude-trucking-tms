#!/usr/bin/env python3
"""Create driver_payroll_settings table in production database."""

import asyncio
import asyncpg
import json
import boto3

async def create_table():
    """Create the driver_payroll_settings table."""

    # Get database credentials from AWS Secrets Manager
    print("🔐 Fetching database credentials from AWS Secrets Manager...")
    secrets_client = boto3.client('secretsmanager', region_name='us-east-1')

    try:
        response = secrets_client.get_secret_value(SecretId='trucking-tms-db-secret')
        secret = json.loads(response['SecretString'])

        # Build connection string
        db_url = f"postgresql://{secret['username']}:{secret['password']}@{secret['host']}:{secret['port']}/{secret['dbname']}"

        print(f"📊 Connecting to database: {secret['host']}...")
        conn = await asyncpg.connect(db_url)

        try:
            print("🔨 Creating driver_payroll_settings table...")

            # Create table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS driver_payroll_settings (
                    id SERIAL PRIMARY KEY,
                    driver_id INTEGER NOT NULL UNIQUE,
                    company_id INTEGER NOT NULL,
                    dispatch_fee_percent NUMERIC(5, 2) DEFAULT 0,
                    insurance_weekly NUMERIC(10, 2) DEFAULT 0,
                    parking_weekly NUMERIC(10, 2) DEFAULT 0,
                    trailer_weekly NUMERIC(10, 2) DEFAULT 0,
                    misc_weekly NUMERIC(10, 2) DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
                );
            """)

            # Create index
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS ix_driver_payroll_settings_id
                ON driver_payroll_settings(id);
            """)

            # Create index on driver_id for faster lookups
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS ix_driver_payroll_settings_driver_id
                ON driver_payroll_settings(driver_id);
            """)

            # Create index on company_id for multi-tenant queries
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS ix_driver_payroll_settings_company_id
                ON driver_payroll_settings(company_id);
            """)

            print("✅ Table created successfully!")
            print("✅ Indexes created successfully!")

            # Verify table exists
            result = await conn.fetchval("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_name = 'driver_payroll_settings'
            """)

            if result > 0:
                print("✅ Verified: driver_payroll_settings table exists")
            else:
                print("❌ Error: Table was not created")

        finally:
            await conn.close()
            print("🔌 Database connection closed")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(create_table())
