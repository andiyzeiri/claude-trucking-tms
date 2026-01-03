#!/usr/bin/env python3
"""
Create driver_day_notes table for dispatch board notes
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_driver_day_notes_table():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        # Create the driver_day_notes table if it doesn't exist
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS driver_day_notes (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                note VARCHAR(500) NOT NULL,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(driver_id, date)
            );
        """))
        print("Created driver_day_notes table (or already exists)")

        # Create index for faster lookups
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_driver_day_notes_company
            ON driver_day_notes(company_id);
        """))
        print("Created index on company_id (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_driver_day_notes_driver_date
            ON driver_day_notes(driver_id, date);
        """))
        print("Created index on driver_id, date (or already exists)")

    await engine.dispose()
    print("Driver day notes table migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(create_driver_day_notes_table())
