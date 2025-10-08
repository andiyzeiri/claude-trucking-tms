"""Create all database tables from SQLAlchemy models"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from app.models.base import Base

async def create_tables():
    """Create all tables in the database"""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        # Import all models to register them with Base
        from app.models.user import User
        from app.models.company import Company
        from app.models.customer import Customer
        from app.models.truck import Truck
        from app.models.driver import Driver
        from app.models.load import Load
        from app.models.stop import Stop
        from app.models.invoice import Invoice
        from app.models.email_verification import EmailVerificationToken

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        print("✅ All tables created successfully!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_tables())
