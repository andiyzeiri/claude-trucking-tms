import boto3
from botocore.exceptions import ClientError
from datetime import timedelta
from typing import Optional
from app.config import settings


class S3Service:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.bucket_name = settings.S3_BUCKET

    def generate_presigned_upload_url(
        self,
        key: str,
        content_type: str,
        expires_in: int = 3600
    ) -> Optional[dict]:
        """Generate a presigned URL for uploading files to S3"""
        try:
            response = self.s3_client.generate_presigned_post(
                Bucket=self.bucket_name,
                Key=key,
                Fields={'Content-Type': content_type},
                Conditions=[
                    {'Content-Type': content_type},
                    ['content-length-range', 1, 50 * 1024 * 1024]  # 50MB max
                ],
                ExpiresIn=expires_in
            )
            return response
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None

    def generate_presigned_download_url(
        self,
        key: str,
        expires_in: int = 3600
    ) -> Optional[str]:
        """Generate a presigned URL for downloading files from S3"""
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expires_in
            )
            return response
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None

    def delete_file(self, key: str) -> bool:
        """Delete a file from S3"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError as e:
            print(f"Error deleting file: {e}")
            return False


s3_service = S3Service()