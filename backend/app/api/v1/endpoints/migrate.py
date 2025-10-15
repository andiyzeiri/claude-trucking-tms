"""
Temporary migration endpoint to update PDF URLs.
This should be removed after migration is complete.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.load import Load
from app.config import settings
import boto3
from botocore.exceptions import ClientError

router = APIRouter()

# Initialize S3 client if using S3
s3_client = None
if settings.USE_S3:
    s3_client = boto3.client(
        's3',
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
    ) if settings.AWS_ACCESS_KEY_ID else boto3.client('s3', region_name=settings.AWS_REGION)


@router.post("/pdf-urls")
async def migrate_pdf_urls(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Migrate old S3 URLs to new API path format.

    Old format: https://trucking-tms-uploads-1759878269.s3.us-east-1.amazonaws.com/abc123.pdf
    New format: /api/v1/uploads/s3/abc123.pdf

    Only allows admin users to run this migration.
    """
    # Only allow admin users
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only admins can run migrations")

    # Get all loads with S3 URLs
    query = select(Load).where(
        (Load.pod_url.like('%s3.amazonaws.com%')) |
        (Load.ratecon_url.like('%s3.amazonaws.com%'))
    )
    result = await db.execute(query)
    loads = result.scalars().all()

    updated_count = 0
    updates = []

    for load in loads:
        updated = False
        old_pod = load.pod_url
        old_ratecon = load.ratecon_url

        # Update pod_url if it's an S3 URL
        if load.pod_url and 's3.amazonaws.com' in load.pod_url:
            filename = load.pod_url.split('/')[-1]
            load.pod_url = f"/api/v1/uploads/s3/{filename}"
            updated = True

        # Update ratecon_url if it's an S3 URL
        if load.ratecon_url and 's3.amazonaws.com' in load.ratecon_url:
            filename = load.ratecon_url.split('/')[-1]
            load.ratecon_url = f"/api/v1/uploads/s3/{filename}"
            updated = True

        if updated:
            updated_count += 1
            updates.append({
                "load_id": load.id,
                "load_number": load.load_number,
                "old_pod_url": old_pod,
                "new_pod_url": load.pod_url,
                "old_ratecon_url": old_ratecon,
                "new_ratecon_url": load.ratecon_url
            })

    # Commit all changes
    await db.commit()

    return {
        "message": f"Successfully migrated {updated_count} loads",
        "total_found": len(loads),
        "updated_count": updated_count,
        "updates": updates
    }


@router.delete("/all-pdfs")
async def delete_all_pdfs(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all PDFs from S3 and clear PDF URLs from database.

    WARNING: This is irreversible! All PDF files will be permanently deleted.

    Only allows admin users to run this operation.
    """
    # Only allow admin users
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only admins can delete all PDFs")

    if not settings.USE_S3 or not s3_client:
        raise HTTPException(status_code=400, detail="S3 is not configured")

    # Get all loads with PDF URLs
    query = select(Load).where(
        (Load.pod_url.isnot(None)) |
        (Load.ratecon_url.isnot(None))
    )
    result = await db.execute(query)
    loads = result.scalars().all()

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

    # Delete files from S3
    deleted_count = 0
    failed_files = []

    for key in s3_keys:
        try:
            s3_client.delete_object(Bucket=settings.S3_BUCKET, Key=key)
            deleted_count += 1
        except ClientError as e:
            failed_files.append({"key": key, "error": str(e)})

    # Clear PDF URLs from database
    for load in loads:
        load.pod_url = None
        load.ratecon_url = None

    await db.commit()

    return {
        "message": f"Successfully deleted {deleted_count} PDF files and cleared {len(loads)} load records",
        "total_loads": len(loads),
        "total_files_found": len(s3_keys),
        "files_deleted": deleted_count,
        "files_failed": len(failed_files),
        "failed_files": failed_files
    }
