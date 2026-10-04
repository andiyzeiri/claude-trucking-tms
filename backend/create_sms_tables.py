#!/usr/bin/env python3
"""
Create the driver SMS tables (POD reminders).

  load_sms_messages   every text sent to or received from a driver: the
                      audit trail, and what stops the reminder job from
                      texting the same load twice
  drivers.sms_opt_out set when a driver replies STOP

Idempotent: safe to run on every container start.
"""

import asyncio
import json
import os

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS load_sms_messages (
        id           SERIAL PRIMARY KEY,
        company_id   INTEGER NOT NULL REFERENCES companies(id),
        load_id      INTEGER REFERENCES loads(id) ON DELETE SET NULL,
        driver_id    INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
        direction    VARCHAR NOT NULL,              -- out | in
        kind         VARCHAR NOT NULL,              -- pod_request | pod_reminder | pod_ack | escalated | reply | pod_media | opt_out | opt_in
        phone        VARCHAR,                       -- the driver's number, E.164
        body         TEXT,
        media        JSONB,                         -- stored POD files for inbound MMS
        twilio_sid   VARCHAR,
        status       VARCHAR,                       -- queued | sent | failed | received
        error        TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_load_sms_messages_load ON load_sms_messages (load_id, direction, kind)",
    "CREATE INDEX IF NOT EXISTS ix_load_sms_messages_phone ON load_sms_messages (company_id, phone, created_at DESC)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_load_sms_messages_sid ON load_sms_messages (twilio_sid) WHERE twilio_sid IS NOT NULL",
    # Tables created by an earlier version of this script.
    "ALTER TABLE load_sms_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ",
    "ALTER TABLE drivers ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE",
]


async def create_sms_tables():
    import asyncpg

    db_secret = os.environ.get("DATABASE_SECRET_JSON")
    if db_secret:
        s = json.loads(db_secret)
        db_url = (
            f"postgresql://{s['username']}:{s['password']}"
            f"@{s['host']}:{s.get('port', 5432)}/{s['dbname']}"
        )
    else:
        db_url = os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")

    if not db_url:
        print("No database URL found, skipping...")
        return

    print("🔧 Creating driver SMS tables...")
    conn = await asyncpg.connect(db_url)
    try:
        for sql in STATEMENTS:
            await conn.execute(sql)
        print("✓ load_sms_messages and drivers.sms_opt_out ready")
    except Exception as e:
        print(f"⚠️ Error creating SMS tables: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_sms_tables())
