#!/usr/bin/env python3
"""Add cc_address and reply_to to inbound_emails (for emailing a POD back to everyone on the rate confirmation). Idempotent."""
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
        await conn.execute(text("ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS cc_address TEXT"))
        await conn.execute(text("ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS reply_to TEXT"))
        # Text of Word attachments, e.g. the BOL sent with an Amazon appointment.
        await conn.execute(text("ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS attachment_text TEXT"))
        print("inbound_emails: cc_address / reply_to / attachment_text ready")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
