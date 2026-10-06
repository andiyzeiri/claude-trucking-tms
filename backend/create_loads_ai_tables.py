#!/usr/bin/env python3
"""
Create the Loads AI ingestion tables.

  inbound_emails      one row per message pulled from the mailbox
  ingested_documents  one row per attachment, with its extraction and the
                      load (if any) created from it

The unique constraints are the point: they are what make the pipeline safe
to re-run. The same message on a second poll, or the same PDF forwarded
twice, hits a constraint instead of creating a duplicate load.

Idempotent: safe to run on every container start.
"""

import asyncio
import json
import os

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS inbound_emails (
        id               SERIAL PRIMARY KEY,
        company_id       INTEGER NOT NULL REFERENCES companies(id),
        source           VARCHAR NOT NULL DEFAULT 'email',
        message_id       VARCHAR NOT NULL,
        from_address     VARCHAR,
        to_address       VARCHAR,
        subject          TEXT,
        received_at      TIMESTAMP,
        status           VARCHAR NOT NULL DEFAULT 'received',
        error            TEXT,
        attachment_count INTEGER DEFAULT 0,
        documents_created INTEGER DEFAULT 0,
        loads_created    INTEGER DEFAULT 0,
        created_at       TIMESTAMPTZ DEFAULT now(),
        updated_at       TIMESTAMPTZ
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_inbound_emails_company_message
        ON inbound_emails (company_id, message_id)
    """,
    "CREATE INDEX IF NOT EXISTS ix_inbound_emails_company_status ON inbound_emails (company_id, status)",
    # Which inbox a message came from (ratecons@ / pods@), so a failed
    # document can be retried in the right mode.
    "ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS mailbox VARCHAR",
    "CREATE INDEX IF NOT EXISTS ix_inbound_emails_company_created ON inbound_emails (company_id, created_at)",
    """
    CREATE TABLE IF NOT EXISTS ingested_documents (
        id                  SERIAL PRIMARY KEY,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        inbound_email_id    INTEGER REFERENCES inbound_emails(id),
        source              VARCHAR NOT NULL DEFAULT 'email',
        original_filename   VARCHAR,
        s3_key              VARCHAR,
        content_type        VARCHAR,
        byte_size           BIGINT,
        sha256              VARCHAR(64) NOT NULL,
        doc_type            VARCHAR,
        doc_type_confidence NUMERIC(5,4),
        status              VARCHAR NOT NULL DEFAULT 'received',
        extraction          JSONB,
        draft               JSONB,
        warnings            JSONB,
        ai_provider         VARCHAR,
        ai_model            VARCHAR,
        input_tokens        INTEGER,
        output_tokens       INTEGER,
        latency_ms          INTEGER,
        load_id             INTEGER REFERENCES loads(id),
        attempt_count       INTEGER NOT NULL DEFAULT 0,
        last_error          TEXT,
        created_at          TIMESTAMPTZ DEFAULT now(),
        updated_at          TIMESTAMPTZ
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ingested_documents_company_sha256
        ON ingested_documents (company_id, sha256)
    """,
    "CREATE INDEX IF NOT EXISTS ix_ingested_documents_company_status ON ingested_documents (company_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_ingested_documents_email ON ingested_documents (inbound_email_id)",
    "CREATE INDEX IF NOT EXISTS ix_ingested_documents_load ON ingested_documents (load_id)",
]


async def create_loads_ai_tables():
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

    print("🔧 Creating Loads AI ingestion tables...")
    conn = await asyncpg.connect(db_url)
    try:
        for sql in STATEMENTS:
            await conn.execute(sql)
        print("✓ inbound_emails and ingested_documents ready")
    except Exception as e:
        print(f"⚠️ Error creating Loads AI tables: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_loads_ai_tables())
