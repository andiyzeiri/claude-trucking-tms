#!/usr/bin/env python3
"""
Migration script to add shippers, receivers tables and MC field to customers
Run this script on the backend server to apply the database changes
"""

import asyncio
from sqlalchemy import text
from app.database import engine


async def run_migration():
    """Run the migration to add shippers, receivers tables and MC field"""

    async with engine.begin() as conn:
        print("Starting migration...")

        # Add MC field to customers table
        print("1. Adding MC field to customers table...")
        try:
            await conn.execute(text("""
                ALTER TABLE customers
                ADD COLUMN IF NOT EXISTS mc VARCHAR
            """))
            print("   ✓ MC field added to customers")
        except Exception as e:
            print(f"   ! MC field may already exist: {e}")

        # Create shippers table
        print("2. Creating shippers table...")
        try:
            await conn.execute(text("""
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
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            print("   ✓ Shippers table created")

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_shippers_id ON shippers (id)
            """))
            print("   ✓ Shippers index created")
        except Exception as e:
            print(f"   ! Shippers table may already exist: {e}")

        # Create receivers table
        print("3. Creating receivers table...")
        try:
            await conn.execute(text("""
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
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            print("   ✓ Receivers table created")

            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_receivers_id ON receivers (id)
            """))
            print("   ✓ Receivers index created")
        except Exception as e:
            print(f"   ! Receivers table may already exist: {e}")

        print("\n✅ Migration completed successfully!")


if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration: Add Shippers, Receivers, and MC field")
    print("=" * 60)
    asyncio.run(run_migration())
