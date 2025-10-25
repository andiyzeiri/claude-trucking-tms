"""
Clear all PDF URLs from database and delete files from S3
Simple version without app imports
"""
import asyncio
import asyncpg
import boto3
from botocore.exceptions import ClientError

# Database configuration
DB_HOST = "trucking-tms-db.csla6kaago6t.us-east-1.rds.amazonaws.com"
DB_NAME = "trucking_tms"
DB_USER = "tmsadmin"
DB_PASS = "VNDNzVg4uQwrsV4XenuYbQG+OlHh5waSoDUzxd85HuM="

# S3 configuration
S3_BUCKET = "trucking-tms-uploads-1759878269"
AWS_REGION = "us-east-1"

async def clear_pdfs():
    """Clear all PDF URLs from database and delete from S3"""

    print("\n" + "="*60)
    print("PDF DELETION SCRIPT")
    print("="*60)

    # Initialize S3 client
    print("\nInitializing S3 client...")
    s3_client = boto3.client('s3', region_name=AWS_REGION)

    # Connect to database
    print("Connecting to database...")
    conn = await asyncpg.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

    try:
        # Get all loads with PDF URLs
        print("\nFetching loads with PDF URLs...")
        loads = await conn.fetch("""
            SELECT id, load_number, pod_url, ratecon_url
            FROM loads
            WHERE pod_url IS NOT NULL OR ratecon_url IS NOT NULL
        """)

        print(f"Found {len(loads)} loads with PDF URLs")

        # Collect all S3 keys to delete
        s3_keys = set()

        for load in loads:
            if load['pod_url']:
                # Extract filename from URL
                url = load['pod_url']
                if 's3.amazonaws.com' in url:
                    filename = url.split('/')[-1]
                    s3_keys.add(filename)
                    print(f"  Load #{load['load_number']}: POD - {filename}")
                elif url.startswith('/api/v1/uploads/s3/'):
                    filename = url.replace('/api/v1/uploads/s3/', '')
                    s3_keys.add(filename)
                    print(f"  Load #{load['load_number']}: POD - {filename}")

            if load['ratecon_url']:
                # Extract filename from URL
                url = load['ratecon_url']
                if 's3.amazonaws.com' in url:
                    filename = url.split('/')[-1]
                    s3_keys.add(filename)
                    print(f"  Load #{load['load_number']}: Ratecon - {filename}")
                elif url.startswith('/api/v1/uploads/s3/'):
                    filename = url.replace('/api/v1/uploads/s3/', '')
                    s3_keys.add(filename)
                    print(f"  Load #{load['load_number']}: Ratecon - {filename}")

        print(f"\n{'='*60}")
        print(f"Total unique PDF files to delete from S3: {len(s3_keys)}")
        print(f"{'='*60}")

        # Delete files from S3
        deleted_count = 0
        failed_count = 0

        if s3_keys:
            print("\nDeleting files from S3...")
            for key in s3_keys:
                try:
                    print(f"  Deleting {key}...")
                    s3_client.delete_object(Bucket=S3_BUCKET, Key=key)
                    deleted_count += 1
                except ClientError as e:
                    print(f"    ⚠ Warning: Failed to delete {key}: {e}")
                    failed_count += 1

            print(f"\n✓ Deleted {deleted_count} files from S3")
            if failed_count > 0:
                print(f"⚠ Failed to delete {failed_count} files")

        # Clear PDF URLs from database
        print("\nClearing PDF URLs from database...")
        result = await conn.execute("""
            UPDATE loads
            SET pod_url = NULL, ratecon_url = NULL
            WHERE pod_url IS NOT NULL OR ratecon_url IS NOT NULL
        """)

        updated_count = int(result.split()[-1])
        print(f"✓ Cleared PDF URLs from {updated_count} loads")

        print("\n" + "="*60)
        print("✓ ALL PDFs DELETED AND DATABASE CLEARED!")
        print("="*60)
        print(f"\nSummary:")
        print(f"  - Files deleted from S3: {deleted_count}")
        print(f"  - Files failed to delete: {failed_count}")
        print(f"  - Database records updated: {updated_count}")
        print(f"{'='*60}\n")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(clear_pdfs())
