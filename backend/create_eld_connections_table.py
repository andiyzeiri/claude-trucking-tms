#!/usr/bin/env python3
"""Create eld_connections (Peak ELD API key, Reports > Mileage) and eld_odometer_readings."""
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
            CREATE TABLE IF NOT EXISTS eld_connections (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                provider VARCHAR(20) NOT NULL DEFAULT 'peak' CHECK (provider IN ('peak')),
                api_key_encrypted TEXT NOT NULL,
                key_last4 VARCHAR(4),
                truck_map JSONB NOT NULL DEFAULT '{}'::jsonb,
                connected_by INTEGER REFERENCES users(id),
                last_ok_at TIMESTAMP WITH TIME ZONE,
                last_error VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("Created eld_connections table")
        await conn.execute(text("ALTER TABLE eld_connections ADD COLUMN IF NOT EXISTS odometer_since TIMESTAMP WITH TIME ZONE;"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS eld_odometer_readings (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                eld_vehicle_id VARCHAR(64) NOT NULL,
                recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
                odometer NUMERIC(12, 1) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT uq_eld_odometer_reading UNIQUE (company_id, eld_vehicle_id, recorded_at)
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_eld_odometer_lookup ON eld_odometer_readings(company_id, eld_vehicle_id, recorded_at);"))
        print("Created eld_odometer_readings table")

    await engine.dispose()
    print("eld_connections migration completed!")


if __name__ == "__main__":
    asyncio.run(create_tables())
