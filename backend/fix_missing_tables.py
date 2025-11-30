#!/usr/bin/env python3
"""Fix missing tables and columns in production database"""
import asyncio
import asyncpg


async def fix_schema():
    """Add missing columns and tables to production database"""

    # Connection string for production
    conn = await asyncpg.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )

    try:
        # Fix trucks table - add type column
        print("Creating TruckType enum...")
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE trucktype AS ENUM ('truck', 'trailer');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        print("✓ Created trucktype enum")

        print("\nAdding type column to trucks table...")
        await conn.execute("""
            ALTER TABLE trucks ADD COLUMN IF NOT EXISTS type trucktype DEFAULT 'truck' NOT NULL;
        """)
        print("✓ Added type column to trucks")

        print("\nAdding mc column to customers table...")
        await conn.execute("""
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS mc VARCHAR;
        """)
        print("✓ Added mc column to customers")

        print("\nCreating shippers table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS shippers (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                address TEXT,
                city VARCHAR,
                state VARCHAR,
                zip_code VARCHAR,
                phone VARCHAR,
                contact_person VARCHAR,
                email VARCHAR,
                product_type VARCHAR,
                average_wait_time VARCHAR,
                appointment_type VARCHAR,
                notes TEXT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_shippers_company ON shippers(company_id);
        """)
        print("✓ Created shippers table")

        print("\nCreating receivers table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS receivers (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                address TEXT,
                city VARCHAR,
                state VARCHAR,
                zip_code VARCHAR,
                phone VARCHAR,
                contact_person VARCHAR,
                email VARCHAR,
                product_type VARCHAR,
                average_wait_time VARCHAR,
                appointment_type VARCHAR,
                notes TEXT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_receivers_company ON receivers(company_id);
        """)
        print("✓ Created receivers table")

        print("\nAdding user_id column to drivers table...")
        await conn.execute("""
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
        """)
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id) WHERE user_id IS NOT NULL;
        """)
        print("✓ Added user_id column to drivers")

        # Verify the changes
        print("\nVerifying schema...")

        # Check customers table
        result = await conn.fetch("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'customers' AND column_name = 'mc';
        """)
        if result:
            print("✓ customers.mc column exists")

        # Check shippers table
        result = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'shippers';
        """)
        if result:
            print("✓ shippers table exists")

        # Check receivers table
        result = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'receivers';
        """)
        if result:
            print("✓ receivers table exists")

        print("\n✅ Schema fixes completed successfully!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(fix_schema())
