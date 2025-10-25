"""
Migrate old S3 URLs to new API path format

This script updates all pod_url and ratecon_url fields in the loads table
from full S3 URLs to API endpoint paths.

Old format: https://trucking-tms-uploads-1759878269.s3.us-east-1.amazonaws.com/abc123.pdf
New format: /api/v1/uploads/s3/abc123.pdf
"""
import asyncio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.load import Load

async def migrate_urls():
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get all loads with S3 URLs
        query = select(Load).where(
            (Load.pod_url.like('%s3.amazonaws.com%')) |
            (Load.ratecon_url.like('%s3.amazonaws.com%'))
        )
        result = await session.execute(query)
        loads = result.scalars().all()

        print(f"Found {len(loads)} loads with S3 URLs to migrate")

        updated_count = 0
        for load in loads:
            updated = False

            # Update pod_url if it's an S3 URL
            if load.pod_url and 's3.amazonaws.com' in load.pod_url:
                filename = load.pod_url.split('/')[-1]
                load.pod_url = f"/api/v1/uploads/s3/{filename}"
                print(f"Load {load.id} - Updated pod_url to: {load.pod_url}")
                updated = True

            # Update ratecon_url if it's an S3 URL
            if load.ratecon_url and 's3.amazonaws.com' in load.ratecon_url:
                filename = load.ratecon_url.split('/')[-1]
                load.ratecon_url = f"/api/v1/uploads/s3/{filename}"
                print(f"Load {load.id} - Updated ratecon_url to: {load.ratecon_url}")
                updated = True

            if updated:
                updated_count += 1

        # Commit all changes
        await session.commit()
        print(f"\nSuccessfully migrated {updated_count} loads")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate_urls())
