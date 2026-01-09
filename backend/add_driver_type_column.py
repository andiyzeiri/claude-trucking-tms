#!/usr/bin/env python3
"""
Add driver_type column to drivers table.
"""
import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def get_db_connection():
    """Get database connection from environment"""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        # Try to parse from JSON secret
        import json
        secret_json = os.environ.get("DATABASE_SECRET_JSON")
        if secret_json:
            secret = json.loads(secret_json)
            database_url = f"postgresql://{secret['username']}:{secret['password']}@{secret['host']}:{secret['port']}/{secret['dbname']}"

    if not database_url:
        print("ERROR: No database connection info found")
        sys.exit(1)

    # Convert asyncpg URL to psycopg2 format
    if "postgresql+asyncpg://" in database_url:
        database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    return psycopg2.connect(database_url)


def add_driver_type_column():
    """Add driver_type column to drivers table."""
    conn = get_db_connection()
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    column_name = "driver_type"
    column_type = "VARCHAR NOT NULL DEFAULT 'company'"

    try:
        # Check if column exists
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'drivers' AND column_name = %s
        """, (column_name,))

        if cursor.fetchone() is None:
            print(f"Adding column {column_name} to drivers table...")
            cursor.execute(f"ALTER TABLE drivers ADD COLUMN {column_name} {column_type}")
            print(f"  Added {column_name}")
        else:
            print(f"  Column {column_name} already exists")
    except Exception as e:
        print(f"  Warning: Could not add {column_name}: {e}")

    cursor.close()
    conn.close()
    print("Driver type column migration complete!")


if __name__ == "__main__":
    add_driver_type_column()
