"""
Application configuration with AWS Secrets Manager support.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import os
import json


class Settings(BaseSettings):
    """
    Application settings.

    Supports two modes:
    1. Local development: Use DATABASE_URL and REDIS_URL environment variables
    2. AWS production: Parse DATABASE_SECRET_JSON and REDIS_SECRET_JSON from Secrets Manager
    """

    # Database - will be overridden if DATABASE_SECRET_JSON exists
    DATABASE_URL: str = "postgresql+asyncpg://postgres:dev@localhost:5432/anditms"

    # Redis - will be overridden if REDIS_SECRET_JSON exists
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Configuration
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AWS Configuration
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET: str = "trucking-tms-uploads-1759878269"
    USE_S3: bool = False  # Set to True in production

    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Andi's Trucking TMS"
    VERSION: str = "1.0.0"

    # Environment
    ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000

    # CORS - allow frontend origins
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,https://absolutetms.netlify.app,https://absolutetms.com"

    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    FROM_EMAIL: Optional[str] = None
    FROM_NAME: str = "Andi's Trucking TMS"
    REQUIRE_EMAIL_VERIFICATION: bool = False  # Set to True when email service is configured

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._parse_secrets()

    def _parse_secrets(self):
        """
        Parse AWS Secrets Manager JSON secrets if they exist.

        In production (ECS), secrets are injected as environment variables:
        - DATABASE_SECRET_JSON: Contains RDS credentials
        - REDIS_SECRET_JSON: Contains Redis connection info

        Format:
        DATABASE_SECRET_JSON = {
            "username": "db_user",
            "password": "db_pass",
            "host": "db.region.rds.amazonaws.com",
            "port": 5432,
            "dbname": "app",
            "engine": "postgres"
        }

        REDIS_SECRET_JSON = {
            "redis_url": "redis://cache.region.cache.amazonaws.com:6379",
            "redis_host": "cache.region.cache.amazonaws.com",
            "redis_port": 6379
        }
        """
        # Parse Database Secret JSON if present
        db_secret_json = os.getenv("DATABASE_SECRET_JSON")
        if db_secret_json:
            try:
                db_secret = json.loads(db_secret_json)
                username = db_secret.get("username")
                password = db_secret.get("password")
                host = db_secret.get("host")
                port = db_secret.get("port", 5432)
                dbname = db_secret.get("dbname")

                # Construct asyncpg connection string for SQLAlchemy
                self.DATABASE_URL = f"postgresql+asyncpg://{username}:{password}@{host}:{port}/{dbname}"
                print(f"✓ Loaded database config from DATABASE_SECRET_JSON")
            except (json.JSONDecodeError, KeyError) as e:
                print(f"⚠ Warning: Failed to parse DATABASE_SECRET_JSON: {e}")
                print(f"⚠ Falling back to DATABASE_URL environment variable")

        # Parse Redis Secret JSON if present
        redis_secret_json = os.getenv("REDIS_SECRET_JSON")
        if redis_secret_json:
            try:
                redis_secret = json.loads(redis_secret_json)
                redis_url = redis_secret.get("redis_url")

                if redis_url:
                    self.REDIS_URL = redis_url
                    print(f"✓ Loaded Redis config from REDIS_SECRET_JSON")
                else:
                    # Construct from host and port if redis_url not provided
                    redis_host = redis_secret.get("redis_host")
                    redis_port = redis_secret.get("redis_port", 6379)
                    if redis_host:
                        self.REDIS_URL = f"redis://{redis_host}:{redis_port}/0"
                        print(f"✓ Constructed Redis URL from host/port")
            except (json.JSONDecodeError, KeyError) as e:
                print(f"⚠ Warning: Failed to parse REDIS_SECRET_JSON: {e}")
                print(f"⚠ Falling back to REDIS_URL environment variable")

    @property
    def backend_cors_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENV.lower() in ("production", "prod")

    @property
    def database_url_sync(self) -> str:
        """
        Get synchronous database URL (for Alembic migrations).
        Replaces asyncpg with psycopg2.
        """
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
