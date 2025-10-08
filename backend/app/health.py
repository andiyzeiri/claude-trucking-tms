"""
Health check endpoint for load balancer and monitoring.
"""
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
import sys

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: str
    service: str
    version: str


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns the health status of the API service. Used by AWS ALB for health checks.",
)
async def health_check():
    """
    Health check endpoint that returns 200 OK.

    This endpoint is used by:
    - AWS Application Load Balancer for target health checks
    - Docker HEALTHCHECK directive
    - Monitoring systems

    Returns:
        HealthResponse: Service health status
    """
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "andi-tms-api",
            "version": "1.0.0",
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        }
    )


@router.get(
    "/health/ready",
    status_code=status.HTTP_200_OK,
    summary="Readiness Check",
    description="Returns readiness status - checks if service can accept traffic.",
)
async def readiness_check():
    """
    Readiness check endpoint.

    Use this to verify the service is ready to accept traffic.
    This can include checking database connectivity, cache availability, etc.

    Returns:
        dict: Readiness status
    """
    # TODO: Add database connection check
    # TODO: Add Redis connection check

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


@router.get(
    "/health/live",
    status_code=status.HTTP_200_OK,
    summary="Liveness Check",
    description="Returns liveness status - checks if service is running.",
)
async def liveness_check():
    """
    Liveness check endpoint.

    Use this to verify the service is still running and responsive.
    This should be a simple check that doesn't depend on external services.

    Returns:
        dict: Liveness status
    """
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
