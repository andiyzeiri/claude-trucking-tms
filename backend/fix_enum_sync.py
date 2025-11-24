#!/usr/bin/env python3
"""Synchronous enum fix"""
import psycopg2

try:
    print("Connecting...")
    conn = psycopg2.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )
    cur = conn.cursor()

    print("Checking enum...")
    cur.execute("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loadstatus')")
    exists = cur.fetchone()[0]

    if not exists:
        print("Dropping old enum...")
        cur.execute("DROP TYPE IF EXISTS load_status CASCADE")

        print("Creating loadstatus enum...")
        cur.execute("CREATE TYPE loadstatus AS ENUM ('available', 'dispatched', 'invoiced')")

        print("Updating loads table...")
        cur.execute("ALTER TABLE loads ALTER COLUMN status TYPE loadstatus USING status::text::loadstatus")

        conn.commit()
        print("✅ Done!")
    else:
        print("✅ Enum already exists!")

    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
