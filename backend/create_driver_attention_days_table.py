#!/usr/bin/env python3
"""
Create driver_attention_days table for dispatch board attention flagging
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_driver_attention_days_table():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        # Create the driver_attention_days table if it doesn't exist
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS driver_attention_days (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(driver_id, date)
            );
        """))
        print("Created driver_attention_days table (or already exists)")

        # Create index for faster lookups
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_driver_attention_days_company
            ON driver_attention_days(company_id);
        """))
        print("Created index on company_id (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_driver_attention_days_driver_date
            ON driver_attention_days(driver_id, date);
        """))
        print("Created index on driver_id, date (or already exists)")

    await engine.dispose()
    print("Driver attention days table migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(create_driver_attention_days_table())
