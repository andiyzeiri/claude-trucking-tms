#!/usr/bin/env python3
"""Add pay structure columns (fixed / per mile / percent) to driver_payroll_settings.

Existing pay_type/pay_rate (set on the Reports page) pre-fill the matching
rate, but pay_structure stays empty, so nobody's Net Pay changes until a
structure is picked on the Payroll page. Idempotent.
"""
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
        await conn.execute(text("ALTER TABLE driver_payroll_settings ADD COLUMN IF NOT EXISTS pay_structure VARCHAR(20)"))
        await conn.execute(text("ALTER TABLE driver_payroll_settings ADD COLUMN IF NOT EXISTS pay_fixed NUMERIC(10,2)"))
        await conn.execute(text("ALTER TABLE driver_payroll_settings ADD COLUMN IF NOT EXISTS pay_per_mile NUMERIC(10,3)"))
        await conn.execute(text("ALTER TABLE driver_payroll_settings ADD COLUMN IF NOT EXISTS pay_percent NUMERIC(5,2)"))
        await conn.execute(text("""
            UPDATE driver_payroll_settings SET pay_per_mile = pay_rate
            WHERE pay_per_mile IS NULL AND pay_type = 'per_mile' AND COALESCE(pay_rate, 0) > 0
        """))
        await conn.execute(text("""
            UPDATE driver_payroll_settings SET pay_fixed = pay_rate
            WHERE pay_fixed IS NULL AND COALESCE(pay_type, 'flat') = 'flat' AND COALESCE(pay_rate, 0) > 0
        """))
        print("Added pay structure columns")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_columns())
