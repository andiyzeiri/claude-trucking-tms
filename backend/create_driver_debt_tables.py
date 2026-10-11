#!/usr/bin/env python3
"""Create driver_debt_entries and driver_debt_plans (Payroll > Debt tab)."""
import asyncio
import os
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_tables():
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
            CREATE TABLE IF NOT EXISTS driver_debt_entries (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                kind VARCHAR(10) NOT NULL CHECK (kind IN ('debt', 'payment')),
                amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
                entry_date DATE NOT NULL,
                note VARCHAR(255),
                created_by INTEGER REFERENCES users(id),
                deleted_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_driver_debt_entries_company ON driver_debt_entries(company_id, driver_id);"))
        print("Created driver_debt_entries table")

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS driver_debt_plans (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                driver_id INTEGER NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
                weekly_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (weekly_amount >= 0),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created driver_debt_plans table")

    await engine.dispose()
    print("driver debt migration completed!")


if __name__ == "__main__":
    asyncio.run(create_tables())
