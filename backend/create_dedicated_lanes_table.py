#!/usr/bin/env python3
"""Create dedicated_lanes table for recurring lane templates"""
import asyncio
import asyncpg


async def create_dedicated_lanes_table():
    """Create the dedicated_lanes table in production database"""

    # Connection string for production
    conn = await asyncpg.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )

    try:
        print("Creating dedicated_lanes table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS dedicated_lanes (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                pickup_location VARCHAR NOT NULL,
                delivery_location VARCHAR NOT NULL,
                miles INTEGER,
                day_of_week INTEGER NOT NULL DEFAULT 0,
                pickup_time TIME,
                delivery_time TIME,
                rate NUMERIC(10, 2),
                carrier_rate NUMERIC(10, 2),
                fuel_surcharge NUMERIC(10, 2) DEFAULT 0,
                accessorial_charges NUMERIC(10, 2) DEFAULT 0,
                pickup_notes TEXT,
                delivery_notes TEXT,
                reference_number VARCHAR,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                customer_id INTEGER NOT NULL REFERENCES customers(id),
                driver_id INTEGER REFERENCES drivers(id),
                truck_id INTEGER REFERENCES trucks(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        print("✓ Created dedicated_lanes table")

        # Create indexes
        print("\nCreating indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_dedicated_lanes_company ON dedicated_lanes(company_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_dedicated_lanes_customer ON dedicated_lanes(customer_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_dedicated_lanes_active ON dedicated_lanes(is_active);
        """)
        print("✓ Created indexes on dedicated_lanes")

        # Verify the table was created
        print("\nVerifying schema...")
        result = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'dedicated_lanes';
        """)
        if result:
            print("✓ dedicated_lanes table exists")

        # Check columns
        result = await conn.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'dedicated_lanes'
            ORDER BY ordinal_position;
        """)
        print(f"✓ Table has {len(result)} columns")
        for row in result:
            print(f"  - {row['column_name']}: {row['data_type']}")

        print("\n✅ dedicated_lanes table created successfully!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_dedicated_lanes_table())
