#!/usr/bin/env python3
"""Create payroll_layouts table: per-company Payroll page rows (custom items, fixed/variable, hidden)."""
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
                company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                rows JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created payroll_layouts table")

    await engine.dispose()
    print("payroll_layouts migration completed!")


if __name__ == "__main__":
    asyncio.run(create_table())
