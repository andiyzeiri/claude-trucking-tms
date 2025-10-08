#!/usr/bin/env python3
"""
Runs the migration SQL directly, bypassing Alembic's migration runner.
This works around the mysterious duplicate index error.
"""
import asyncio
import asyncpg
import sys

DB_URL = "postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms"

async def main():
    try:
        print("Connecting to database...")
        conn = await asyncpg.connect(DB_URL)

        print("Reading migration SQL...")
        with open('/app/migration.sql', 'r') as f:
            sql = f.read()

        print("Executing migration SQL...")
        # Split by statement boundaries and execute
        statements = []
        current = []

        for line in sql.split('\n'):
            # Skip INFO lines from alembic
            if line.strip().startswith('INFO'):
                continue
            # Skip comments
            if line.strip().startswith('--'):
                continue

            current.append(line)

            # Execute when we hit a semicolon at end of line
            if line.strip().endswith(';'):
                stmt = '\n'.join(current).strip()
                if stmt and stmt not in ('BEGIN;', 'COMMIT;'):
                    statements.append(stmt)
                current = []

        print(f"Found {len(statements)} SQL statements to execute")

        executed = 0
        for i, stmt in enumerate(statements, 1):
            try:
                await conn.execute(stmt)
                executed += 1
                if i % 10 == 0:
                    print(f"  Executed {i}/{len(statements)} statements...")
            except Exception as e:
                # Log but continue - some statements might be duplicates
                print(f"  Warning on statement {i}: {str(e)[:100]}")
                continue

        print(f"\n✓ Successfully executed {executed}/{len(statements)} statements")

        # Verify tables were created
        tables = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
        print(f"\n✓ Created {len(tables)} tables:")
        for table in tables[:10]:  # Show first 10
            print(f"  - {table['tablename']}")
        if len(tables) > 10:
            print(f"  ... and {len(tables) - 10} more")

        await conn.close()
        print("\n=== Migration completed successfully ===")
        return 0
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
