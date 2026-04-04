#!/usr/bin/env python3
"""Create payroll_overrides table for storing payroll field overrides."""
import asyncio
import os
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_table():
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
            CREATE TABLE IF NOT EXISTS payroll_overrides (
                id SERIAL PRIMARY KEY,
                driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                year INTEGER NOT NULL,
                week_number INTEGER NOT NULL,
                field VARCHAR(50) NOT NULL,
                value NUMERIC(12, 2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created payroll_overrides table")

        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_overrides_unique
            ON payroll_overrides(company_id, driver_id, year, week_number, field);
        """))
        print("Created unique index on payroll_overrides")

    await engine.dispose()
    print("payroll_overrides migration completed!")


if __name__ == "__main__":
    asyncio.run(create_table())
