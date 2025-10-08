#!/usr/bin/env python3
"""Manually verify a user's email for testing"""
import asyncio
import asyncpg
import sys

DB_URL = "postgresql://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms"

async def verify_user(username: str):
    conn = await asyncpg.connect(DB_URL)

    result = await conn.execute(
        "UPDATE users SET email_verified = true WHERE username = $1",
        username
    )

    if result == "UPDATE 1":
        print(f"✓ User '{username}' email verified successfully")
    else:
        print(f"✗ User '{username}' not found")

    await conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify-user.py <username>")
        sys.exit(1)

    asyncio.run(verify_user(sys.argv[1]))
