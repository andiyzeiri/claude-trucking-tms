#!/usr/bin/env python3
"""Create ifta table for IFTA (International Fuel Tax Agreement) tracking"""
import asyncio
import asyncpg


async def create_ifta_table():
    """Create the ifta table in production database"""

    # Connection string for production
    conn = await asyncpg.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )

    try:
        print("Creating ifta table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ifta (
                id SERIAL PRIMARY KEY,
                year INTEGER NOT NULL,
                quarter INTEGER NOT NULL,
                jurisdiction VARCHAR(2) NOT NULL,
                total_miles INTEGER DEFAULT 0,
                taxable_miles INTEGER DEFAULT 0,
                tax_paid_gallons NUMERIC(10, 2) DEFAULT 0,
                mpg NUMERIC(10, 3),
                notes TEXT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                truck_id INTEGER REFERENCES trucks(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        print("✓ Created ifta table")

        # Create indexes
        print("\nCreating indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_ifta_company ON ifta(company_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_ifta_year_quarter ON ifta(year, quarter);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_ifta_jurisdiction ON ifta(jurisdiction);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_ifta_truck ON ifta(truck_id);
        """)
        print("✓ Created indexes on ifta")

        # Create unique constraint for company+year+quarter+jurisdiction+truck
        print("\nCreating unique constraint...")
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_ifta_unique_entry
            ON ifta(company_id, year, quarter, jurisdiction, COALESCE(truck_id, 0));
        """)
        print("✓ Created unique constraint")

        # Verify the table was created
        print("\nVerifying schema...")
        result = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'ifta';
        """)
        if result:
            print("✓ ifta table exists")

        # Check columns
        result = await conn.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'ifta'
            ORDER BY ordinal_position;
        """)
        print(f"✓ Table has {len(result)} columns")
        for row in result:
            print(f"  - {row['column_name']}: {row['data_type']}")

        print("\n✅ ifta table created successfully!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_ifta_table())
