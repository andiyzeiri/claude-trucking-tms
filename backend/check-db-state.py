#!/usr/bin/env python3
import asyncio
import asyncpg

DB_URL = "postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms"

async def main():
    conn = await asyncpg.connect(DB_URL)

    # Check for tables
    tables = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
    print(f"\n=== Tables in database ({len(tables)}): ===")
    for table in tables:
        print(f"  - {table['tablename']}")

    # Check for indexes
    indexes = await conn.fetch("""
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
    """)
    print(f"\n=== Indexes in database ({len(indexes)}): ===")
    for idx in indexes:
        print(f"  - {idx['indexname']} on {idx['tablename']}")

    # Check for PostGIS
    postgis = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis');")
    print(f"\n=== PostGIS enabled: {postgis} ===")

    await conn.close()

asyncio.run(main())
