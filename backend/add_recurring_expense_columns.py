#!/usr/bin/env python3
"""Add recurring expense columns to expenses table."""
import asyncio
import os
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def add_columns():
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
        await conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS frequency VARCHAR"))
        await conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pay_day INTEGER"))
        await conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES expenses(id)"))
        print("Added recurring expense columns")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_columns())
