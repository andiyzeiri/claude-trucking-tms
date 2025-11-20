#!/usr/bin/env python3
"""
Check user in database
"""
import asyncio
import asyncpg
import os
import sys


async def check_user():
    """Check user data"""
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔍 Checking user data...")
    print(f"📍 Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")

        # Check the user
        user = await conn.fetchrow("""
            SELECT id, email, hashed_password, first_name, last_name, role
            FROM users
            WHERE email = $1
        """, "absolutetruckingbusiness@gmail.com")

        if user:
            print(f"✅ User found:")
            print(f"   ID: {user['id']}")
            print(f"   Email: {user['email']}")
            print(f"   First Name: {user['first_name']}")
            print(f"   Last Name: {user['last_name']}")
            print(f"   Role: {user['role']}")
            print(f"   Hashed Password: {user['hashed_password'][:60] if user['hashed_password'] else 'NULL'}...")
            print(f"   Password length: {len(user['hashed_password']) if user['hashed_password'] else 0}")
            print(f"   Password type: {type(user['hashed_password'])}")
        else:
            print("❌ User not found!")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Check failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(check_user())
    sys.exit(exit_code)
