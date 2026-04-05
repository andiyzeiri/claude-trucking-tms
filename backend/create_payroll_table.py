#!/usr/bin/env python3
"""Create payroll table."""
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
        # Create payrolltype enum
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE payrolltype AS ENUM ('company', 'owner_operator');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS payroll (
                id SERIAL PRIMARY KEY,
                week_start DATE NOT NULL,
                week_end DATE NOT NULL,
                driver_id INTEGER NOT NULL REFERENCES drivers(id),
                type payrolltype NOT NULL,
                gross FLOAT DEFAULT 0.0,
                extra FLOAT DEFAULT 0.0,
                dispatch_fee FLOAT DEFAULT 0.0,
                insurance FLOAT DEFAULT 0.0,
                fuel FLOAT DEFAULT 0.0,
                parking FLOAT DEFAULT 0.0,
                trailer FLOAT DEFAULT 0.0,
                misc FLOAT DEFAULT 0.0,
                escrow FLOAT DEFAULT 0.0,
                miles INTEGER DEFAULT 0,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created payroll table")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_table())
