#!/usr/bin/env python3
"""Add truck_id column to driver_payroll_settings table."""
import asyncio
import os
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def add_column():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        database_secret = os.environ.get("DATABASE_SECRET_JSON")
        if database_secret:
            secret = json.loads(database_secret)
            database_url = f"postgresql+asyncpg://{secret['username']}:{secret['password']}@{secret['host']}:{secret.get('port', 5432)}/{secret['dbname']}"
        else:
            print("No DATABASE_URL or DATABASE_SECRET_JSON found")
            return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE driver_payroll_settings
            ADD COLUMN IF NOT EXISTS truck_id INTEGER REFERENCES trucks(id);
        """))
        print("Added truck_id column to driver_payroll_settings")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_column())
