#!/usr/bin/env python3
"""
Create initial user account
"""
import asyncio
import asyncpg
import os
import sys
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_user():
    """Create initial user and tenant"""
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Creating initial user...")
    print(f"📍 Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")

        # Check if tenant exists
        tenant = await conn.fetchrow("SELECT id FROM tenants LIMIT 1")

        if not tenant:
            print("🔧 Creating default tenant...")
            tenant_id = await conn.fetchval("""
                INSERT INTO tenants (name, slug, contact_email, subscription_status)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            """, "Absolute Trucking", "absolute", "absolutetruckingbusiness@gmail.com", "active")
            print(f"✅ Tenant created with ID: {tenant_id}")
        else:
            tenant_id = tenant['id']
            print(f"✅ Using existing tenant ID: {tenant_id}")

        # Check if user already exists
        existing_user = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1",
            "absolutetruckingbusiness@gmail.com"
        )

        if existing_user:
            print("⚠️  User already exists!")
            await conn.close()
            return 0

        # Hash the password
        hashed_password = pwd_context.hash("roskovec")

        # Create the user
        print("🔧 Creating user account...")
        user_id = await conn.fetchval("""
            INSERT INTO users (
                tenant_id, email, hashed_password, first_name, last_name,
                role, is_active, is_superuser, email_verified
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        """, tenant_id, "absolutetruckingbusiness@gmail.com", hashed_password,
            "Admin", "User", "admin", True, True, True)

        print(f"✅ User created successfully!")
        print(f"   Email: absolutetruckingbusiness@gmail.com")
        print(f"   Password: roskovec")
        print(f"   User ID: {user_id}")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Failed to create user: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(create_user())
    sys.exit(exit_code)
