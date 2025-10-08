#!/usr/bin/env python3
"""
This script fully resets the trucking TMS database and runs migrations.
It connects from within an ECS task that has network access to RDS.
"""
import asyncio
import asyncpg
import sys

DB_URL = "postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms"

async def main():
    try:
        print("Connecting to database...")
        conn = await asyncpg.connect(DB_URL)

        print("Dropping all tables and extensions...")
        await conn.execute("DROP SCHEMA IF EXISTS public CASCADE;")
        print("✓ Schema dropped")

        print("Recreating schema...")
        await conn.execute("CREATE SCHEMA public;")
        print("✓ Schema created")

        print("Granting permissions...")
        await conn.execute("GRANT ALL ON SCHEMA public TO tmsadmin;")
        await conn.execute("GRANT ALL ON SCHEMA public TO public;")
        print("✓ Permissions granted")

        print("Enabling PostGIS extension...")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        print("✓ PostGIS enabled")

        # Verify PostGIS
        version = await conn.fetchval("SELECT PostGIS_version();")
        print(f"✓ PostGIS version: {version}")

        await conn.close()
        print("\n=== Database reset complete ===")
        print("Next step: Run migrations with 'alembic upgrade head'")
        return 0
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
