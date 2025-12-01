#!/usr/bin/env python3
"""
Fix drivers table - add missing columns for employment dates and additional info
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

def fix_drivers_table():
    """Add missing columns to drivers table"""
    conn = get_db_connection()
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    columns_to_add = [
        ("date_hired", "DATE"),
        ("date_terminated", "DATE"),
        ("date_of_birth", "DATE"),
        ("experience", "VARCHAR(100)"),
        ("mvr_expiry", "DATE"),
        ("medical_card_expiry", "DATE"),
    ]

    for column_name, column_type in columns_to_add:
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
    print("Drivers table fix complete!")

if __name__ == "__main__":
    fix_drivers_table()
