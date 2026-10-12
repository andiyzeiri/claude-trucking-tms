#!/usr/bin/env python3
"""Create driver_pay_rate_versions: dated driver pay rates, so a changed rate
applies from the week it was changed and earlier weeks keep the old one."""
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
            CREATE TABLE IF NOT EXISTS driver_pay_rate_versions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                effective_from DATE NOT NULL,
                values JSONB NOT NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT uq_driver_pay_rate_version UNIQUE (driver_id, effective_from)
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_driver_pay_rate_versions_company ON driver_pay_rate_versions(company_id, driver_id);"))
        print("Created driver_pay_rate_versions table")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_table())
