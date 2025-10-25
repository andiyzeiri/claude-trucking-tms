"""
Clear all PDF URLs from database and delete files from S3
"""
import asyncio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import boto3
from botocore.exceptions import ClientError
import os

# Database configuration
DATABASE_URL = "postgresql+asyncpg://tmsadmin:VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM=@trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com:5432/trucking_tms"

# S3 configuration
S3_BUCKET = "trucking-tms-uploads-1759878269"
AWS_REGION = "us-east-1"

# Import Load model
import sys
sys.path.insert(0, '/home/andi/claude-trucking-tms/backend')
from app.models.load import Load

async def clear_pdfs():
    """Clear all PDF URLs from database and delete from S3"""

    # Initialize S3 client
    s3_client = boto3.client('s3', region_name=AWS_REGION)

    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get all loads with PDF URLs
        query = select(Load).where(
            (Load.pod_url.isnot(None)) |
            (Load.ratecon_url.isnot(None))
        )
        result = await session.execute(query)
        loads = result.scalars().all()

        print(f"\nFound {len(loads)} loads with PDF URLs")

        # Collect all S3 keys to delete
        s3_keys = set()

        for load in loads:
            if load.pod_url:
                # Extract filename from URL
                if 's3.amazonaws.com' in load.pod_url:
                    filename = load.pod_url.split('/')[-1]
                    s3_keys.add(filename)
                elif load.pod_url.startswith('/api/v1/uploads/s3/'):
                    filename = load.pod_url.replace('/api/v1/uploads/s3/', '')
                    s3_keys.add(filename)

            if load.ratecon_url:
                # Extract filename from URL
                if 's3.amazonaws.com' in load.ratecon_url:
                    filename = load.ratecon_url.split('/')[-1]
                    s3_keys.add(filename)
                elif load.ratecon_url.startswith('/api/v1/uploads/s3/'):
                    filename = load.ratecon_url.replace('/api/v1/uploads/s3/', '')
                    s3_keys.add(filename)

        print(f"\nFound {len(s3_keys)} unique PDF files to delete from S3")

        # Delete files from S3
        deleted_count = 0
        failed_count = 0

        for key in s3_keys:
            try:
                print(f"Deleting {key} from S3...")
                s3_client.delete_object(Bucket=S3_BUCKET, Key=key)
                deleted_count += 1
            except ClientError as e:
                print(f"  Warning: Failed to delete {key}: {e}")
                failed_count += 1

        print(f"\n✓ Deleted {deleted_count} files from S3")
        if failed_count > 0:
            print(f"⚠ Failed to delete {failed_count} files")

        # Clear PDF URLs from database
        for load in loads:
            load.pod_url = None
            load.ratecon_url = None

        await session.commit()
        print(f"\n✓ Cleared PDF URLs from {len(loads)} loads in database")

    await engine.dispose()
    print("\n" + "="*60)
    print("✓ ALL PDFs DELETED AND DATABASE CLEARED!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(clear_pdfs())
