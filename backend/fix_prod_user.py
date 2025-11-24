#!/usr/bin/env python3
"""
Fix production user record to match schema expectations
"""
import asyncio
import asyncpg

# Database connection details
DB_HOST = "andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_USER = "anditms"
DB_PASSWORD = "AndiTMS2024Pass"
DB_NAME = "anditms"


async def fix_user():
    """Fix the user record"""
    print("🔧 Fixing production user...")

    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )

        print("✅ Connected")

        # First, let's check if there's a companies table and get/create a company
        print("\n1. Checking companies...")
        companies = await conn.fetch("SELECT id, name FROM companies LIMIT 5")

        if companies:
            print(f"Found {len(companies)} companies:")
            for c in companies:
                print(f"  - ID: {c['id']}, Name: {c['name']}")
            company_id = companies[0]['id']
        else:
            print("No companies found, creating one...")
            company_id = await conn.fetchval("""
                INSERT INTO companies (name, address, city, state, zip_code, phone, email)
                VALUES ('Absolute Trucking', '123 Main St', 'City', 'TX', '12345', '555-1234', 'contact@absolutetrucking.net')
                RETURNING id
            """)
            print(f"Created company with ID: {company_id}")

        # Update the user with proper values
        print(f"\n2. Updating user with company_id={company_id}...")
        result = await conn.execute("""
            UPDATE users
            SET
                username = $1,
                company_id = $2
            WHERE email = $3
        """, "absolutetrucking", company_id, "absolutetruckingbusiness@gmail.com")

        print(f"✅ Update result: {result}")

        # Verify the update
        user = await conn.fetchrow("""
            SELECT id, username, email, first_name, last_name, company_id, role
            FROM users
            WHERE email = $1
        """, "absolutetruckingbusiness@gmail.com")

        if user:
            print("\n✅ User after update:")
            print(f"  ID: {user['id']} (type: {type(user['id'])})")
            print(f"  Username: {user['username']}")
            print(f"  Email: {user['email']}")
            print(f"  Name: {user['first_name']} {user['last_name']}")
            print(f"  Company ID: {user['company_id']}")
            print(f"  Role: {user['role']}")

        await conn.close()
        print("\n✅ Done!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(fix_user())
