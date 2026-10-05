from contextlib import asynccontextmanager
from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from app.config import settings
from app.api.v1.api import api_router
from app.health import router as health_router
from app.services.dedicated_lane_scheduler import generate_loads_from_dedicated_lanes
from app.documents.pipeline import run_ingestion_job
from app.sms.pod_reminders import run_pod_reminder_job

# Set up logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info("Starting dedicated lane scheduler...")

    # Schedule load generation every Monday at midnight (00:00)
    scheduler.add_job(
        generate_loads_from_dedicated_lanes,
        CronTrigger(day_of_week='mon', hour=0, minute=0),
        id='generate_dedicated_loads',
        name='Generate loads from dedicated lanes',
        replace_existing=True
    )

    # Loads AI mailbox poller. Only scheduled when ingestion is switched on,
    # so a deployment without credentials configured does nothing at all.
    #
    # max_instances=1 and coalesce=True matter: a cycle can take minutes (each
    # document is a ~27s model call) and this shares a 0.25 vCPU task with the
    # API. Without them, slow cycles would pile up and starve web requests.
    if settings.LOADS_AI_INGESTION_ENABLED:
        scheduler.add_job(
            run_ingestion_job,
            IntervalTrigger(minutes=settings.LOADS_AI_POLL_MINUTES),
            id="loads_ai_ingestion",
            name="Read mailbox and create loads",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info(
            "Loads AI ingestion scheduled every %s minute(s)",
            settings.LOADS_AI_POLL_MINUTES,
        )
    else:
        logger.info("Loads AI ingestion is disabled; mailbox will not be polled")

    # Driver POD reminder texts. Same overlap guards as ingestion.
    if settings.POD_REMINDERS_ENABLED:
        scheduler.add_job(
            run_pod_reminder_job,
            IntervalTrigger(minutes=settings.POD_CHECK_MINUTES),
            id="pod_reminders",
            name="Text drivers for PODs",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info(
            "POD reminders scheduled every %s minute(s) (dry_run=%s, company=%s)",
            settings.POD_CHECK_MINUTES, settings.POD_REMINDERS_DRY_RUN, settings.POD_REMINDERS_COMPANY_ID,
        )
    else:
        logger.info("POD reminders are disabled; no driver texts will be sent")

    scheduler.start()
    logger.info("Dedicated lane scheduler started - will run every Monday at 00:00")

    yield

    # Shutdown
    logger.info("Shutting down dedicated lane scheduler...")
    scheduler.shutdown()
    logger.info("Scheduler shut down")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-tenant Transportation Management System API",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS middleware - use configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Validation error handler to log detailed validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"🚨 Validation error on {request.method} {request.url.path}: {exc.errors()}")
    try:
        body = await request.body()
        logger.error(f"🚨 Request body: {body.decode('utf-8')[:1000]}")
    except Exception:
        pass
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        # jsonable_encoder: a field_validator's ValueError rides along in each
        # error's "ctx", and raw json.dumps can't serialise it - which turned
        # every validation message (e.g. "Invalid email address") into a 500.
        content={"detail": jsonable_encoder(exc.errors())},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        }
    )

# Global exception handler to ensure CORS headers are always present
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        }
    )

# Include health check router (no prefix, at root level)
app.include_router(health_router)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"{settings.PROJECT_NAME} API is running",
        "version": settings.VERSION,
        "environment": settings.ENV,
        "docs_url": "/docs" if settings.DEBUG else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)