#!/usr/bin/env python3
import asyncio
import asyncpg
import sys

async def main():
    try:
        conn = await asyncpg.connect(
            'postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms'
        )
        print("Connected to database")

        await conn.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
        print("PostGIS extension enabled successfully")

        # Verify PostGIS is installed
        result = await conn.fetchval("SELECT PostGIS_version();")
        print(f"PostGIS version: {result}")

        await conn.close()
        print("Done")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
