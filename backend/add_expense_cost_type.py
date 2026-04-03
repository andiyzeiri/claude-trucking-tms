"""Add cost_type column to expenses table."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import get_database_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def add_cost_type():
    engine = create_async_engine(get_database_url())
    async with engine.begin() as conn:
        # Add cost_type column if it doesn't exist
        await conn.execute(text("""
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cost_type VARCHAR DEFAULT 'variable' NOT NULL
        """))
        print("Added cost_type column to expenses table")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_cost_type())
