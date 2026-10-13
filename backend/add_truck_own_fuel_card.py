#!/usr/bin/env python3
"""Add trucks.own_fuel_card: owner fuels on their own card (red, bottom of the Fuel page). Idempotent."""
import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        secret = os.environ.get("DATABASE_SECRET_JSON")
        if not secret:
            print("No DATABASE_URL or DATABASE_SECRET_JSON found")
            return
        s = json.loads(secret)
        database_url = f"postgresql+asyncpg://{s['username']}:{s['password']}@{s['host']}:{s.get('port', 5432)}/{s['dbname']}"
    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS own_fuel_card BOOLEAN NOT NULL DEFAULT FALSE"))
        print("trucks: own_fuel_card ready")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
