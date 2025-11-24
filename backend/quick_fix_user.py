#!/usr/bin/env python3
"""
Quick fix - add username to production user
"""
import asyncio
import asyncpg

DB_HOST = "andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_USER = "anditms"
DB_PASSWORD = "AndiTMS2024Pass"
DB_NAME = "anditms"


async def fix():
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )

    # Get tenant ID or create a default one
    tenant = await conn.fetchrow("SELECT id, name FROM tenants LIMIT 1")

    if not tenant:
        print("Creating default tenant...")
        tenant_id = await conn.fetchval("""
            INSERT INTO tenants (name, contact_email, contact_phone, is_active)
            VALUES ('Absolute Trucking', 'contact@absolutetrucking.net', '555-1234', true)
            RETURNING id
        """)
    else:
        tenant_id = tenant['id']
        print(f"Using tenant: {tenant['name']} ({tenant_id})")

    # Update user
    result = await conn.execute("""
        UPDATE users
        SET
            username = 'absolutetrucking',
            tenant_id = $1,
            company_id = $1
        WHERE email = 'absolutetruckingbusiness@gmail.com'
    """, tenant_id)

    print(f"Update result: {result}")

    # Verify
    user = await conn.fetchrow("""
        SELECT id, username, email, tenant_id, company_id
        FROM users
        WHERE email = 'absolutetruckingbusiness@gmail.com'
    """)

    print(f"\nUser after update:")
    print(f"  ID: {user['id']}")
    print(f"  Username: {user['username']}")
    print(f"  Email: {user['email']}")
    print(f"  Tenant ID: {user['tenant_id']}")
    print(f"  Company ID: {user['company_id']}")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(fix())
