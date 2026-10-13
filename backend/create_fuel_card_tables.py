#!/usr/bin/env python3
"""Create fuel_card_connections and fuel_card_transactions (WEX Fleet One / EFS SFTP file feed)."""
import asyncio
import os
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def create_tables():
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
            CREATE TABLE IF NOT EXISTS fuel_card_connections (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                provider VARCHAR(20) NOT NULL DEFAULT 'wex_sftp' CHECK (provider IN ('wex_sftp')),
                host VARCHAR(255) NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                remote_dir VARCHAR(255) NOT NULL DEFAULT '/',
                username VARCHAR(100) NOT NULL,
                password_encrypted TEXT NOT NULL,
                import_from DATE NOT NULL,
                card_map JSONB NOT NULL DEFAULT '{}'::jsonb,
                processed_files JSONB NOT NULL DEFAULT '[]'::jsonb,
                connected_by INTEGER REFERENCES users(id),
                last_sync_at TIMESTAMP WITH TIME ZONE,
                last_sync_result VARCHAR(255),
                last_error VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created fuel_card_connections table")

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fuel_card_transactions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                provider VARCHAR(20) NOT NULL DEFAULT 'wex_sftp',
                external_id VARCHAR(40) NOT NULL,
                transaction_date TIMESTAMP,
                card_last6 VARCHAR(6),
                unit VARCHAR(40),
                driver_prompt VARCHAR(60),
                odometer INTEGER,
                location VARCHAR(255),
                fuel_gallons NUMERIC(10, 3) DEFAULT 0,
                fuel_amount NUMERIC(12, 2) DEFAULT 0,
                def_gallons NUMERIC(10, 3) DEFAULT 0,
                def_amount NUMERIC(12, 2) DEFAULT 0,
                other_amount NUMERIC(12, 2) DEFAULT 0,
                other_items VARCHAR(255),
                net_total NUMERIC(12, 2) DEFAULT 0,
                status VARCHAR(20) NOT NULL CHECK (status IN ('imported', 'linked', 'needs_truck', 'not_fuel')),
                truck_id INTEGER REFERENCES trucks(id),
                fuel_id INTEGER REFERENCES fuel(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT uq_fuel_card_tx_external UNIQUE (company_id, provider, external_id)
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fuel_card_tx_company_status ON fuel_card_transactions(company_id, status);"))
        # A swipe moved to another truck by hand (two trucks sharing a card).
        await conn.execute(text("ALTER TABLE fuel_card_transactions ADD COLUMN IF NOT EXISTS manual_truck BOOLEAN NOT NULL DEFAULT FALSE;"))
        print("Created fuel_card_transactions table")

    await engine.dispose()
    print("fuel card migration completed!")


if __name__ == "__main__":
    asyncio.run(create_tables())
