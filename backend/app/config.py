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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 240  # 4 hours
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

    # Email transport selection.
    #   "auto"    - SES if SES_FROM_EMAIL is set, else SMTP if credentials
    #               are present, else console (logs instead of sending)
    #   "ses"     - force AWS SES
    #   "smtp"    - force SMTP
    #   "console" - never send, just log. Useful locally.
    EMAIL_TRANSPORT: str = "auto"
    SES_REGION: Optional[str] = None       # falls back to AWS_REGION
    SES_FROM_EMAIL: Optional[str] = None   # must be a verified SES identity
    REQUIRE_EMAIL_VERIFICATION: bool = False  # Set to True when email service is configured

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    # Twilio Configuration
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    TWILIO_EMAIL_FROM: Optional[str] = None

    # Google Maps Configuration
    GOOGLE_MAPS_API_KEY: Optional[str] = None

    # Loads AI document extraction (Anthropic / Claude).
    #
    # ANTHROPIC_API_KEY may be injected directly, or as ANTHROPIC_SECRET_JSON
    # from Secrets Manager (same shape as DATABASE_SECRET_JSON). When neither
    # is set, extraction is disabled and the endpoint returns a clear 503
    # rather than failing mid-request.
    ANTHROPIC_API_KEY: Optional[str] = None
    DOCUMENT_AI_PROVIDER: str = "anthropic"
    DOCUMENT_AI_MODEL: str = "claude-opus-5"
    # Extraction is transcription, not reasoning - low effort keeps latency
    # and cost down. Thinking is left at its default (on) because disabling
    # it on this model has known failure modes.
    DOCUMENT_AI_EFFORT: str = "low"
    DOCUMENT_AI_MAX_TOKENS: int = 8000
    # Hard cap on what we will hand to the model. 32MB is the API request
    # limit; stay well under it once base64 expansion is accounted for.
    DOCUMENT_MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024

    # --- Loads AI email ingestion -------------------------------------
    #
    # Off by default. Turning it on makes the app log into a mailbox and
    # create loads unattended, which should be a deliberate act.
    #
    # The mailbox is tied to a tenant by matching LOADS_AI_IMAP_USERNAME
    # against companies.loads_ai_source_email - the field set on the
    # Loads AI page. No match, no ingestion.
    LOADS_AI_INGESTION_ENABLED: bool = False
    LOADS_AI_IMAP_HOST: str = "imap.gmail.com"
    LOADS_AI_IMAP_PORT: int = 993
    LOADS_AI_IMAP_USERNAME: Optional[str] = None
    # Gmail requires an App Password here, not the account password.
    # Supply via LOADS_AI_IMAP_SECRET_JSON in production.
    LOADS_AI_IMAP_PASSWORD: Optional[str] = None
    LOADS_AI_IMAP_FOLDER: str = "INBOX"

    # How often the poller runs, and how much work one cycle may do. The
    # caps matter: each document is a ~27s model call costing a few cents,
    # and this runs in-process on a 0.25 vCPU task.
    LOADS_AI_POLL_MINUTES: int = 5
    LOADS_AI_MAX_MESSAGES_PER_POLL: int = 5
    LOADS_AI_MAX_DOCUMENTS_PER_POLL: int = 10

    # Create loads straight from a document rather than queueing a draft.
    # Documents that cannot be auto-created (unmatched broker, no rate)
    # still land as needs_review - loads.customer_id is NOT NULL, so there
    # is no way to create those unattended.
    LOADS_AI_AUTO_CREATE_LOADS: bool = True
    # Mark auto-created loads so a human can spot them on the board.
    LOADS_AI_FLAG_CREATED_LOADS: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = True  # Make environment variable names case-sensitive

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

        # Parse Anthropic Secret JSON if present.
        # Accepts {"api_key": "..."} or {"ANTHROPIC_API_KEY": "..."}.
        anthropic_secret_json = os.getenv("ANTHROPIC_SECRET_JSON")
        if anthropic_secret_json:
            try:
                anthropic_secret = json.loads(anthropic_secret_json)
                api_key = (
                    anthropic_secret.get("api_key")
                    or anthropic_secret.get("ANTHROPIC_API_KEY")
                )
                if api_key:
                    self.ANTHROPIC_API_KEY = api_key
                    print("✓ Loaded Anthropic API key from ANTHROPIC_SECRET_JSON")
                else:
                    print("⚠ Warning: ANTHROPIC_SECRET_JSON has no api_key field")
            except (json.JSONDecodeError, KeyError) as e:
                print(f"⚠ Warning: Failed to parse ANTHROPIC_SECRET_JSON: {e}")

        # Parse Loads AI mailbox credentials if present.
        # Accepts {"username": "...", "password": "..."}.
        imap_secret_json = os.getenv("LOADS_AI_IMAP_SECRET_JSON")
        if imap_secret_json:
            try:
                imap_secret = json.loads(imap_secret_json)
                if imap_secret.get("username"):
                    self.LOADS_AI_IMAP_USERNAME = imap_secret["username"]
                if imap_secret.get("password"):
                    self.LOADS_AI_IMAP_PASSWORD = imap_secret["password"]
                print("✓ Loaded Loads AI mailbox credentials from LOADS_AI_IMAP_SECRET_JSON")
            except (json.JSONDecodeError, KeyError) as e:
                print(f"⚠ Warning: Failed to parse LOADS_AI_IMAP_SECRET_JSON: {e}")

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
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        print(f"✓ CORS Origins loaded: {origins}")
        return origins

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
