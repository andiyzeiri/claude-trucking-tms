#!/usr/bin/env python3
"""
Add adjustment_type and adjustment_amount columns to loads table
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def add_adjustment_columns():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        # Create the adjustment type enum if it doesn't exist
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE adjustmenttype AS ENUM ('lumper', 'detention', 'layover', 'pickup', 'delivery');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        print("Created adjustmenttype enum (or already exists)")

        # Add adjustment_type column if it doesn't exist
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE loads ADD COLUMN adjustment_type adjustmenttype;
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        """))
        print("Added adjustment_type column (or already exists)")

        # Add adjustment_amount column if it doesn't exist
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE loads ADD COLUMN adjustment_amount NUMERIC(10, 2);
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        """))
        print("Added adjustment_amount column (or already exists)")

    await engine.dispose()
    print("Adjustment columns migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_adjustment_columns())
