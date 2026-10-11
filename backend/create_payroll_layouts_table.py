#!/usr/bin/env python3
"""Create payroll_layouts table: per-company, per-driver-type Payroll page rows (custom items, fixed/variable, hidden)."""
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
            CREATE TABLE IF NOT EXISTS payroll_layouts (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                driver_type VARCHAR(20) NOT NULL DEFAULT 'company',
                rows JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created payroll_layouts table")

        # One layout per driver type (company drivers / owner operators).
        await conn.execute(text("""
            ALTER TABLE payroll_layouts
            ADD COLUMN IF NOT EXISTS driver_type VARCHAR(20) NOT NULL DEFAULT 'company';
        """))
        await conn.execute(text("ALTER TABLE payroll_layouts DROP CONSTRAINT IF EXISTS payroll_layouts_company_id_key;"))
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE payroll_layouts
                ADD CONSTRAINT uq_payroll_layouts_company_type UNIQUE (company_id, driver_type);
            EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
            END $$;
        """))
        print("payroll_layouts: one layout per driver type")

        await conn.execute(text("ALTER TABLE payroll_layouts ADD COLUMN IF NOT EXISTS driver_order JSONB;"))
        print("payroll_layouts: driver_order column")

    await engine.dispose()
    print("payroll_layouts migration completed!")


if __name__ == "__main__":
    asyncio.run(create_table())
