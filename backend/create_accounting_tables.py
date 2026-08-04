#!/usr/bin/env python3
"""
Create the general ledger tables: accounts, journal_entries,
journal_lines, accounting_mappings.

Idempotent - safe to run on every container start.
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_accounting_tables():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(database_url)

    async with engine.begin() as conn:
        # ------------------------------------------------------------------
        # Chart of accounts
        # ------------------------------------------------------------------
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(20) NOT NULL,
                normal_balance VARCHAR(6) NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                parent_id INTEGER REFERENCES accounts(id),
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT accounts_type_chk
                    CHECK (type IN ('asset','liability','equity','revenue','expense')),
                CONSTRAINT accounts_normal_balance_chk
                    CHECK (normal_balance IN ('debit','credit')),
                CONSTRAINT accounts_company_code_uniq UNIQUE (company_id, code)
            );
        """))
        print("Created accounts table (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_accounts_company ON accounts(company_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_accounts_code ON accounts(code);
        """))

        # ------------------------------------------------------------------
        # Journal entry headers
        # ------------------------------------------------------------------
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS journal_entries (
                id SERIAL PRIMARY KEY,
                entry_number VARCHAR(30),
                entry_date DATE NOT NULL,
                memo TEXT,
                status VARCHAR(10) NOT NULL DEFAULT 'draft',
                source VARCHAR(20) NOT NULL DEFAULT 'manual',
                source_id INTEGER,
                posted_at TIMESTAMP WITH TIME ZONE,
                posted_by_id INTEGER REFERENCES users(id),
                created_by_id INTEGER REFERENCES users(id),
                reverses_id INTEGER REFERENCES journal_entries(id),
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT je_status_chk CHECK (status IN ('draft','posted','void')),
                CONSTRAINT je_source_chk
                    CHECK (source IN ('manual','invoice','fuel','expense','payroll')),
                CONSTRAINT je_company_number_uniq UNIQUE (company_id, entry_number)
            );
        """))
        print("Created journal_entries table (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_je_company_date
            ON journal_entries(company_id, entry_date);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_je_company_source
            ON journal_entries(company_id, source, source_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_je_entry_number ON journal_entries(entry_number);
        """))

        # ------------------------------------------------------------------
        # Journal entry lines
        # ------------------------------------------------------------------
        # numeric(12,4) per the project money rule. The subledger tables use
        # numeric(10,2); posting into (12,4) widens, so nothing rounds.
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS journal_lines (
                id SERIAL PRIMARY KEY,
                journal_entry_id INTEGER NOT NULL
                    REFERENCES journal_entries(id) ON DELETE CASCADE,
                account_id INTEGER NOT NULL REFERENCES accounts(id),
                line_number INTEGER NOT NULL DEFAULT 1,
                debit NUMERIC(12,4) NOT NULL DEFAULT 0,
                credit NUMERIC(12,4) NOT NULL DEFAULT 0,
                memo TEXT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT jl_nonneg_chk CHECK (debit >= 0 AND credit >= 0),
                CONSTRAINT jl_one_side_chk CHECK (NOT (debit > 0 AND credit > 0))
            );
        """))
        print("Created journal_lines table (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_jl_entry ON journal_lines(journal_entry_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_jl_company_account
            ON journal_lines(company_id, account_id);
        """))

        # ------------------------------------------------------------------
        # Auto-post mappings
        # ------------------------------------------------------------------
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS accounting_mappings (
                id SERIAL PRIMARY KEY,
                event_key VARCHAR(20) NOT NULL,
                debit_account_id INTEGER NOT NULL REFERENCES accounts(id),
                credit_account_id INTEGER NOT NULL REFERENCES accounts(id),
                company_id INTEGER NOT NULL REFERENCES companies(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT am_event_key_chk
                    CHECK (event_key IN ('invoice','fuel','expense','payroll')),
                CONSTRAINT am_distinct_accounts_chk
                    CHECK (debit_account_id <> credit_account_id),
                CONSTRAINT am_company_event_uniq UNIQUE (company_id, event_key)
            );
        """))
        print("Created accounting_mappings table (or already exists)")

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_am_company ON accounting_mappings(company_id);
        """))

    await engine.dispose()
    print("Accounting tables migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(create_accounting_tables())
