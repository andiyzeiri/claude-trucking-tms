#!/usr/bin/env python3
"""
Create driver_days_off table for persisting driver time off
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_driver_days_off_table():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        # Create the driver_days_off table if it doesn't exist
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS driver_days_off (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(driver_id, date)
            );
        """))
        print("Created driver_days_off table (or already exists)")

        # Create index for faster lookups
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_driver_days_off_company
            ON driver_days_off(company_id);
        """))
        print("Created index on company_id (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_driver_days_off_driver_date
            ON driver_days_off(driver_id, date);
        """))
        print("Created index on driver_id, date (or already exists)")

    await engine.dispose()
    print("Driver days off table migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(create_driver_days_off_table())
