#!/usr/bin/env python3
"""
Reset user password
"""
import asyncio
import asyncpg
import os
import sys
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def reset_password():
    """Reset user password"""
    db_url = os.environ.get('DATABASE_URL', '')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Convert SQLAlchemy URL format to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')

    print("🔄 Resetting user password...")
    print(f"📍 Connecting to database...")

    try:
        conn = await asyncpg.connect(db_url)

        print("✅ Connected successfully")

        # Hash the password
        hashed_password = pwd_context.hash("roskovec")
        print(f"🔧 New password hash: {hashed_password[:50]}...")

        # Update the user's password
        print("🔧 Updating password for absolutetruckingbusiness@gmail.com...")
        result = await conn.execute("""
            UPDATE users
            SET hashed_password = $1
            WHERE email = $2
        """, hashed_password, "absolutetruckingbusiness@gmail.com")

        print(f"📊 Update result: {result}")

        # Verify the update
        check_user = await conn.fetchrow("""
            SELECT email, hashed_password
            FROM users
            WHERE email = $1
        """, "absolutetruckingbusiness@gmail.com")

        if check_user:
            print(f"✅ Verified - Password hash starts with: {check_user['hashed_password'][:20]}...")
            print(f"   Hash length: {len(check_user['hashed_password'])}")
        else:
            print("❌ User not found after update!")

        print("✅ Password reset successfully!")

        await conn.close()
        return 0

    except Exception as e:
        print(f"❌ Password reset failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(reset_password())
    sys.exit(exit_code)
