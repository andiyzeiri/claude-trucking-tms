#!/usr/bin/env python3
"""
Add fuel card columns to drivers table.
"""
import asyncio
import os
import sys

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import async_engine


async def add_fuel_card_columns():
    """Add has_fuel_card and fuel_card_number columns to drivers table."""
    async with async_engine.begin() as conn:
        # Check if columns exist
        result = await conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'drivers' AND column_name IN ('has_fuel_card', 'fuel_card_number')
        """))
        existing_columns = {row[0] for row in result.fetchall()}

        # Add has_fuel_card column if it doesn't exist
        if 'has_fuel_card' not in existing_columns:
            print("Adding has_fuel_card column to drivers table...")
            await conn.execute(text("""
                ALTER TABLE drivers
                ADD COLUMN has_fuel_card BOOLEAN NOT NULL DEFAULT FALSE
            """))
            print("✅ Added has_fuel_card column")
        else:
            print("ℹ️ has_fuel_card column already exists")

        # Add fuel_card_number column if it doesn't exist
        if 'fuel_card_number' not in existing_columns:
            print("Adding fuel_card_number column to drivers table...")
            await conn.execute(text("""
                ALTER TABLE drivers
                ADD COLUMN fuel_card_number VARCHAR NULL
            """))
            print("✅ Added fuel_card_number column")
        else:
            print("ℹ️ fuel_card_number column already exists")

        print("✅ Fuel card columns migration complete!")


if __name__ == "__main__":
    asyncio.run(add_fuel_card_columns())
