#!/usr/bin/env python3
"""
Grant the 'accounting' page to admins who already have explicit
page_permissions.

Stored page_permissions take priority over role defaults
(see User.allowed_pages), so without this an existing company_admin
would never see the new page even though their role allows it.

Deliberately scoped to admin roles only - accounting is financial data
and must not leak to dispatchers, drivers, customers, or viewers.
"""

import asyncio
import json
import os


async def add_accounting_permission():
    import asyncpg

    db_secret = os.environ.get("DATABASE_SECRET_JSON")
    if db_secret:
        secret = json.loads(db_secret)
        db_url = (
            f"postgresql://{secret['username']}:{secret['password']}"
            f"@{secret['host']}:{secret.get('port', 5432)}/{secret['dbname']}"
        )
    else:
        db_url = os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")

    if not db_url:
        print("No database URL found, skipping...")
        return

    print("🔧 Adding accounting to admin page permissions...")
    conn = await asyncpg.connect(db_url)

    try:
        # users.page_permissions is declared JSON in the model, but this has
        # to work either way. jsonb_set only accepts jsonb, so the result
        # must be cast back to whatever the column actually is - there is no
        # implicit json/jsonb assignment cast in PostgreSQL.
        col_type = await conn.fetchval("""
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'page_permissions'
        """)
        if col_type is None:
            print("⚠️ users.page_permissions column not found, skipping")
            return

        cast_back = "jsonb" if col_type == "jsonb" else "json"
        print(f"   page_permissions column is {col_type}, casting result to {cast_back}")

        result = await conn.execute(f"""
            UPDATE users
            SET page_permissions = jsonb_set(
                page_permissions::jsonb,
                '{{pages}}',
                (page_permissions::jsonb->'pages') || '["accounting"]'::jsonb
            )::{cast_back}
            WHERE page_permissions IS NOT NULL
              AND page_permissions::jsonb ? 'pages'
              AND jsonb_typeof(page_permissions::jsonb->'pages') = 'array'
              AND NOT (page_permissions::jsonb->'pages' @> '["accounting"]'::jsonb)
              AND (
                    lower(role) IN ('super_admin', 'company_admin')
                    OR is_superuser = TRUE
              )
        """)
        print(f"✓ Updated admin page permissions: {result}")

    except Exception as e:
        print(f"⚠️ Error updating permissions: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(add_accounting_permission())
