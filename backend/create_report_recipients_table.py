#!/usr/bin/env python3
"""
Create the report_recipients table - email addresses that receive each
emailed report.

Idempotent; safe to run on every container start.
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_report_recipients_table():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS report_recipients (
                id SERIAL PRIMARY KEY,
                report_key VARCHAR(40) NOT NULL,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT rr_report_key_chk CHECK (report_key IN ('weekly_trips')),
                CONSTRAINT rr_company_report_email_uniq
                    UNIQUE (company_id, report_key, email)
            );
        """))
        print("Created report_recipients table (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_rr_company
            ON report_recipients(company_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_rr_company_report
            ON report_recipients(company_id, report_key);
        """))

    await engine.dispose()
    print("report_recipients migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(create_report_recipients_table())
