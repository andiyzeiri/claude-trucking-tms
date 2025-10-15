from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.config import settings
import os
import uuid
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

router = APIRouter()

# Create uploads directory if it doesn't exist (for local storage)
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Initialize S3 client if using S3
s3_client = None
if settings.USE_S3:
    s3_client = boto3.client(
        's3',
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
    ) if settings.AWS_ACCESS_KEY_ID else boto3.client('s3', region_name=settings.AWS_REGION)


@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a file to S3 or local storage and return the URL"""

    # Validate file type (only PDFs)
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Generate unique filename
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"

    try:
        contents = await file.read()

        if settings.USE_S3 and s3_client:
            # Upload to S3
            s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=unique_filename,
                Body=contents,
                ContentType='application/pdf'
            )
            # Store the S3 key instead of the direct URL
            # The key will be used to generate signed URLs when retrieving
            file_url = f"/api/v1/uploads/s3/{unique_filename}"
        else:
            # Local storage fallback
            file_path = UPLOAD_DIR / unique_filename
            with open(file_path, 'wb') as f:
                f.write(contents)
            file_url = f"/api/v1/uploads/files/{unique_filename}"

        return {
            "filename": file.filename,
            "url": file_url,
            "size": len(contents)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/s3/{filename}")
async def get_s3_file(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """Generate a presigned URL for an S3 file"""
    if not settings.USE_S3 or not s3_client:
        raise HTTPException(status_code=400, detail="S3 is not configured")

    try:
        # Generate a presigned URL that expires in 1 hour
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET,
                'Key': filename
            },
            ExpiresIn=3600  # 1 hour
        )

        # Return a redirect to the presigned URL
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=presigned_url)

    except ClientError as e:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate signed URL: {str(e)}")


@router.get("/files/{filename}")
async def get_file(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """Serve uploaded files from local storage"""
    from fastapi.responses import FileResponse

    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type='application/pdf',
        filename=filename
    )


@router.delete("/files/{filename}")
async def delete_file(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete an uploaded file"""

    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    return {"message": "File deleted successfully"}
