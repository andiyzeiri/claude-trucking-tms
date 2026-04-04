"""Add cost_type column to expenses table."""
import asyncio
import os
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def add_cost_type():
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
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cost_type VARCHAR DEFAULT 'variable' NOT NULL
        """))
        print("Added cost_type column to expenses table")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_cost_type())
