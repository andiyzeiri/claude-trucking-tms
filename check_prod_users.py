#!/usr/bin/env python3
"""Check production database users"""
import asyncio
import asyncpg


async def main():
    # Production database connection
    conn = await asyncpg.connect(
        host="andi-tms-db-v2.csla6kaago6t.us-east-1.rds.amazonaws.com",
        port=5432,
        user="anditms",
        password="AndiTMS2024Pass",
        database="anditms"
    )

    try:
        # Query users
        rows = await conn.fetch(
            "SELECT id, username, email, first_name, last_name, is_active, role, company_id FROM users ORDER BY id"
        )

        print("\n=== Production Users ===")
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"Username: {row['username']}")
            print(f"Email: {row['email']}")
            print(f"Name: {row['first_name']} {row['last_name']}")
            print(f"Active: {row['is_active']}")
            print(f"Role: {row['role']}")
            print(f"Company ID: {row['company_id']}")
            print("-" * 50)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
