#!/usr/bin/env python3
"""
Create rate_to_operate table for theoretical cost-per-mile tracking
(Variable Costs, Fixed Costs, and Cost Per Mile Summary rows).
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_rate_to_operate_table():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rate_to_operate (
                id SERIAL PRIMARY KEY,
                section VARCHAR NOT NULL,
                expense VARCHAR NOT NULL DEFAULT '',
                miles NUMERIC(12, 2) NOT NULL DEFAULT 0,
                rate_per_mile NUMERIC(12, 4) NOT NULL DEFAULT 0,
                total NUMERIC(12, 2) NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created rate_to_operate table (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_rate_to_operate_company
            ON rate_to_operate(company_id);
        """))
        print("Created index on company_id")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_rate_to_operate_company_section
            ON rate_to_operate(company_id, section);
        """))
        print("Created index on (company_id, section)")

    await engine.dispose()
    print("rate_to_operate table migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(create_rate_to_operate_table())
