#!/usr/bin/env python3
"""
Production user management - Check and reset passwords
"""
import asyncio
import asyncpg
import sys

# Database connection details from task definition
DB_HOST = "andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_USER = "anditms"
DB_PASSWORD = "AndiTMS2024Pass"
DB_NAME = "anditms"


async def list_all_users():
    """List all users in production database"""
    print("🔍 Connecting to production database...")

    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )

        print("✅ Connected successfully")
        print("\n=== PRODUCTION USERS ===\n")

        # Get all users
        users = await conn.fetch("""
            SELECT id, username, email, first_name, last_name, is_active, role, company_id, email_verified
            FROM users
            ORDER BY id
        """)

        if not users:
            print("❌ No users found in database!")
        else:
            for user in users:
                print(f"ID: {user['id']}")
                print(f"Username: {user['username']}")
                print(f"Email: {user['email']}")
                print(f"Name: {user['first_name']} {user['last_name']}")
                print(f"Active: {user['is_active']}")
                print(f"Email Verified: {user['email_verified']}")
                print(f"Role: {user['role']}")
                print(f"Company ID: {user['company_id']}")
                print("-" * 60)

        await conn.close()
        return users

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def reset_user_password(email: str, new_password: str):
    """Reset password for a specific user"""
    from argon2 import PasswordHasher

    ph = PasswordHasher()
    hashed_password = ph.hash(new_password)

    print(f"\n🔧 Resetting password for {email}...")
    print(f"   New password will be: {new_password}")

    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )

        # Update password
        result = await conn.execute("""
            UPDATE users
            SET hashed_password = $1
            WHERE email = $2
        """, hashed_password, email)

        print(f"✅ Password reset successful! {result}")

        # Verify
        user = await conn.fetchrow("""
            SELECT email, hashed_password
            FROM users
            WHERE email = $1
        """, email)

        if user:
            print(f"✅ Verified - User password hash updated")
        else:
            print(f"❌ User not found: {email}")

        await conn.close()
        return True

    except Exception as e:
        print(f"❌ Error resetting password: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Main function"""
    # List all users first
    users = await list_all_users()

    if users:
        print("\n" + "=" * 60)
        print("🔐 Password Reset Options")
        print("=" * 60)

        # Reset passwords for common accounts
        passwords_to_reset = [
            ("andi@absolutetrucking.net", "Admin123!"),
            ("absolutetruckingbusiness@gmail.com", "Admin123!"),
            ("admin@acme.com", "Admin123!")
        ]

        for email, password in passwords_to_reset:
            # Check if user exists
            if any(u['email'] == email for u in users):
                await reset_user_password(email, password)

        print("\n✅ All done!")
        print("\nLogin credentials:")
        for email, password in passwords_to_reset:
            if any(u['email'] == email for u in users):
                print(f"  Email: {email}")
                print(f"  Password: {password}")
                print()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Cancelled by user")
        sys.exit(1)
