#!/usr/bin/env python3
"""
Add needs_attention column to loads table for dispatch board attention flag
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def add_needs_attention_column():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        # Add the needs_attention column if it doesn't exist
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE loads ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT FALSE NOT NULL;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END $$;
        """))
        print("Added needs_attention column to loads table (or already exists)")

    await engine.dispose()
    print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(add_needs_attention_column())
