#!/usr/bin/env python3
"""
Script to add MC field to customers table
"""
import asyncio
from sqlalchemy import text
from app.database import async_engine

async def add_mc_field():
    async with async_engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='customers' AND column_name='mc'
        """))
        exists = result.fetchone()

        if not exists:
            print("Adding MC field to customers table...")
            await conn.execute(text("ALTER TABLE customers ADD COLUMN mc VARCHAR"))
            print("✓ MC field added successfully")
        else:
            print("✓ MC field already exists")

if __name__ == "__main__":
    asyncio.run(add_mc_field())
