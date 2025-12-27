#!/usr/bin/env python3
"""Add IFTA to existing page_permissions for users who have fuel access"""
import asyncio
import json
import os
import sys

async def add_ifta_to_permissions():
    import asyncpg

    # Get database URL from environment
    db_secret = os.environ.get('DATABASE_SECRET_JSON')
    if db_secret:
        secret = json.loads(db_secret)
        db_url = f"postgresql://{secret['username']}:{secret['password']}@{secret['host']}:{secret.get('port', 5432)}/{secret['dbname']}"
    else:
        db_url = os.environ.get('DATABASE_URL', '').replace('+asyncpg', '')

    if not db_url:
        print("No database URL found, skipping...")
        return

    print("🔧 Adding IFTA to user permissions...")
    conn = await asyncpg.connect(db_url)

    try:
        # Update all users who have page_permissions with 'fuel' but not 'ifta'
        result = await conn.execute("""
            UPDATE users
            SET page_permissions = jsonb_set(
                page_permissions,
                '{pages}',
                (page_permissions->'pages') || '["ifta"]'::jsonb
            )
            WHERE page_permissions IS NOT NULL
            AND page_permissions::text LIKE '%"fuel"%'
            AND page_permissions::text NOT LIKE '%"ifta"%'
        """)

        print(f"✓ Updated user permissions: {result}")

    except Exception as e:
        print(f"⚠️ Error updating permissions: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(add_ifta_to_permissions())
