from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.config import settings
from app.api.v1.api import api_router
from app.health import router as health_router
from app.services.dedicated_lane_scheduler import generate_loads_from_dedicated_lanes

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