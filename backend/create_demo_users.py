#!/usr/bin/env python3

import asyncio
import sys
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import settings
from app.models.company import Company
from app.models.user import User, UserRole
from app.core.security import get_password_hash

async def create_demo_data():
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Check if demo company exists
            result = await session.execute(select(Company).where(Company.name == "Demo Company"))
            company = result.scalar_one_or_none()

            if not company:
                # Create demo company
                company = Company(
                    name="Demo Company",
                    address="123 Demo Street",
                    phone="(555) 123-4567",
                    email="demo@company.com"
                )
                session.add(company)
                await session.commit()
                await session.refresh(company)
                print(f"Created demo company: {company.name}")

            # Create demo users with different roles
            demo_users = [
                {
                    "email": "admin@company.com",
                    "password": "admin123",
                    "first_name": "Admin",
                    "last_name": "User",
                    "role": UserRole.COMPANY_ADMIN,
                    "is_superuser": False
                },
                {
                    "email": "dispatcher@company.com",
                    "password": "dispatch123",
                    "first_name": "Dispatch",
                    "last_name": "User",
                    "role": UserRole.DISPATCHER,
                    "is_superuser": False
                },
                {
                    "email": "driver@company.com",
                    "password": "driver123",
                    "first_name": "Driver",
                    "last_name": "User",
                    "role": UserRole.DRIVER,
                    "is_superuser": False
                },
                {
                    "email": "customer@company.com",
                    "password": "customer123",
                    "first_name": "Customer",
                    "last_name": "User",
                    "role": UserRole.CUSTOMER,
                    "is_superuser": False
                },
                {
                    "email": "superadmin@system.com",
                    "password": "super123",
                    "first_name": "Super",
                    "last_name": "Admin",
                    "role": UserRole.SUPER_ADMIN,
                    "is_superuser": True
                }
            ]

            for user_data in demo_users:
                # Check if user already exists
                result = await session.execute(select(User).where(User.email == user_data["email"]))
                existing_user = result.scalar_one_or_none()

                if not existing_user:
                    user = User(
                        email=user_data["email"],
                        hashed_password=get_password_hash(user_data["password"]),
                        first_name=user_data["first_name"],
                        last_name=user_data["last_name"],
                        role=user_data["role"],
                        is_superuser=user_data["is_superuser"],
                        company_id=company.id,
                        is_active=True
                    )
                    session.add(user)
                    print(f"Created user: {user_data['email']} ({user_data['role'].value})")
                else:
                    print(f"User already exists: {user_data['email']}")

            await session.commit()
            print("Demo data creation completed successfully!")

        except Exception as e:
            await session.rollback()
            print(f"Error creating demo data: {e}")
            raise e

if __name__ == "__main__":
    asyncio.run(create_demo_data())