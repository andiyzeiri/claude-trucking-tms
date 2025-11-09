"""
Google Maps API endpoints for distance calculation and routing.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.core.security import get_current_active_user
from app.models.user import User
import googlemaps
from googlemaps.exceptions import ApiError, TransportError, Timeout

router = APIRouter()


class DistanceRequest(BaseModel):
    origin: str
    destination: str
    unit: str = "imperial"  # "imperial" for miles, "metric" for kilometers


class DistanceResponse(BaseModel):
    distance_miles: Optional[float]
    distance_km: Optional[float]
    duration_minutes: Optional[float]
    origin_address: str
    destination_address: str
    status: str
    error: Optional[str] = None


@router.post("/calculate-distance", response_model=DistanceResponse)
async def calculate_distance(
    request: DistanceRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Calculate distance and duration between two addresses using Google Maps API.

    Args:
        request: DistanceRequest with origin and destination addresses
        current_user: Authenticated user

    Returns:
        DistanceResponse with calculated distance in miles and kilometers
    """
    # Check if Google Maps API key is configured
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Google Maps API is not configured. Please contact administrator."
        )

    try:
        # Initialize Google Maps client
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)

        # Request distance matrix
        result = gmaps.distance_matrix(
            origins=[request.origin],
            destinations=[request.destination],
            mode="driving",
            units=request.unit
        )

        # Check if we got valid results
        if result["status"] != "OK":
            return DistanceResponse(
                distance_miles=None,
                distance_km=None,
                duration_minutes=None,
                origin_address=request.origin,
                destination_address=request.destination,
                status="error",
                error=f"Google Maps API returned status: {result['status']}"
            )

        # Extract the first (and only) element
        element = result["rows"][0]["elements"][0]

        if element["status"] != "OK":
            return DistanceResponse(
                distance_miles=None,
                distance_km=None,
                duration_minutes=None,
                origin_address=request.origin,
                destination_address=request.destination,
                status="error",
                error=f"Route not found: {element['status']}"
            )

        # Extract distance and duration
        distance_meters = element["distance"]["value"]
        duration_seconds = element["duration"]["value"]

        # Convert to miles and kilometers
        distance_km = distance_meters / 1000
        distance_miles = distance_km * 0.621371  # km to miles conversion
        duration_minutes = duration_seconds / 60

        # Get formatted addresses
        origin_address = result["origin_addresses"][0]
        destination_address = result["destination_addresses"][0]

        return DistanceResponse(
            distance_miles=round(distance_miles, 1),
            distance_km=round(distance_km, 1),
            duration_minutes=round(duration_minutes, 1),
            origin_address=origin_address,
            destination_address=destination_address,
            status="success"
        )

    except ApiError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Google Maps API error: {str(e)}"
        )
    except TransportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Network error connecting to Google Maps: {str(e)}"
        )
    except Timeout as e:
        raise HTTPException(
            status_code=504,
            detail="Request to Google Maps timed out. Please try again."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error calculating distance: {str(e)}"
        )
