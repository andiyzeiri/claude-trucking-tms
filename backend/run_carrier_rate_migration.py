#!/usr/bin/env python3
"""
Run migration to add carrier_rate, pickup_notes, and delivery_notes columns to loads table.
"""
import asyncio
import asyncpg
import os
import sys


async def run_migration():
    # Get database URL from environment or construct it
    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        # Fallback to constructing from individual env vars
        db_host = os.getenv('DB_HOST', 'trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com')
        db_port = os.getenv('DB_PORT', '5432')
        db_user = os.getenv('DB_USER', 'tmsadmin')
        db_pass = os.getenv('DB_PASS', 'VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=')
        db_name = os.getenv('DB_NAME', 'trucking_tms')

        database_url = f'postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}'

    # Remove asyncpg driver prefix if present
    if database_url.startswith('postgresql+asyncpg://'):
        database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')

    print(f"Connecting to database...")

    try:
        conn = await asyncpg.connect(database_url)

        print("Running migration...")

        # Create expenses table if it doesn't exist
        print("Creating expenses table...")
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                category VARCHAR NOT NULL,
                description TEXT,
                amount NUMERIC(10, 2) NOT NULL,
                vendor VARCHAR,
                payment_method VARCHAR,
                receipt_number VARCHAR,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                driver_id INTEGER REFERENCES drivers(id),
                truck_id INTEGER REFERENCES trucks(id),
                load_id INTEGER REFERENCES loads(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        ''')

        await conn.execute('''
            CREATE INDEX IF NOT EXISTS ix_expenses_id ON expenses(id);
        ''')

        # Create fuel table if it doesn't exist
        print("Creating fuel table...")
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS fuel (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                location VARCHAR,
                gallons NUMERIC(10, 2) NOT NULL,
                price_per_gallon NUMERIC(10, 3),
                total_amount NUMERIC(10, 2) NOT NULL,
                odometer INTEGER,
                notes TEXT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                driver_id INTEGER REFERENCES drivers(id),
                truck_id INTEGER REFERENCES trucks(id),
                load_id INTEGER REFERENCES loads(id),
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE
            );
        ''')

        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_fuel_company_id ON fuel(company_id);
        ''')
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_fuel_driver_id ON fuel(driver_id);
        ''')
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_fuel_truck_id ON fuel(truck_id);
        ''')
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel(date);
        ''')

        # Add carrier_rate columns to loads table
        print("Adding carrier_rate columns to loads table...")
        await conn.execute('''
            ALTER TABLE loads
            ADD COLUMN IF NOT EXISTS carrier_rate NUMERIC(10, 2),
            ADD COLUMN IF NOT EXISTS pickup_notes TEXT,
            ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
        ''')

        # Verify columns exist
        result = await conn.fetch("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='loads'
            AND column_name IN ('carrier_rate', 'pickup_notes', 'delivery_notes')
            ORDER BY column_name;
        """)

        columns = [row['column_name'] for row in result]
        print(f"✅ Migration successful!")
        print(f"✅ Verified columns exist: {columns}")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(run_migration())
    sys.exit(exit_code)
