"""
Notification endpoints for sending SMS and emails via Twilio
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.driver import Driver
from app.models.load import Load
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.twilio_service import get_twilio_service, TwilioService

router = APIRouter()


# Pydantic schemas for requests
class SMSRequest(BaseModel):
    """Request model for sending SMS"""
    to_phone: str = Field(..., description="Phone number in E.164 format or US format")
    message: str = Field(..., min_length=1, max_length=1600, description="SMS message content")
    media_url: str | None = Field(None, description="Optional media URL for MMS")


class BulkSMSRequest(BaseModel):
    """Request model for sending bulk SMS"""
    recipients: List[dict] = Field(..., description="List of recipients with phone and optional name")
    message: str = Field(..., min_length=1, max_length=1600, description="SMS message template")


class LoadAssignmentNotification(BaseModel):
    """Request model for load assignment notification"""
    driver_id: int = Field(..., description="Driver ID")
    load_id: int = Field(..., description="Load ID")


class LoadUpdateNotification(BaseModel):
    """Request model for load update notification"""
    driver_id: int = Field(..., description="Driver ID")
    load_id: int = Field(..., description="Load ID")
    update_message: str = Field(..., description="Update message")


@router.post("/sms/send")
async def send_sms(
    request: SMSRequest,
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send SMS to a single recipient

    Requires:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_PHONE_NUMBER

    Set in environment variables
    """
    result = await twilio_service.send_sms(
        to_phone=request.to_phone,
        message=request.message,
        media_url=request.media_url
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to send SMS')
        )

    return result


@router.post("/sms/bulk")
async def send_bulk_sms(
    request: BulkSMSRequest,
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send SMS to multiple recipients

    Recipients format:
    [
        {"phone": "+1234567890", "name": "John Doe"},
        {"phone": "+0987654321", "name": "Jane Smith"}
    ]

    Message template can include {name} placeholder
    """
    result = await twilio_service.send_bulk_sms(
        recipients=request.recipients,
        message_template=request.message
    )

    return result


@router.post("/loads/assignment")
async def notify_load_assignment(
    request: LoadAssignmentNotification,
    db: AsyncSession = Depends(get_db),
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send load assignment notification to driver

    Automatically formats a message with load details
    """
    # Fetch driver
    driver_query = select(Driver).where(
        Driver.id == request.driver_id,
        Driver.company_id == current_user.company_id
    )
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if not driver.phone:
        raise HTTPException(status_code=400, detail="Driver has no phone number on file")

    # Fetch load
    load_query = select(Load).where(
        Load.id == request.load_id,
        Load.company_id == current_user.company_id
    )
    load_result = await db.execute(load_query)
    load = load_result.scalar_one_or_none()

    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Send notification
    result = await twilio_service.send_load_assignment_sms(
        driver_phone=driver.phone,
        driver_name=f"{driver.first_name} {driver.last_name}",
        load_number=load.load_number,
        pickup_location=load.pickup_location or "TBD",
        delivery_location=load.delivery_location or "TBD",
        pickup_date=load.pickup_date.strftime("%m/%d/%Y") if load.pickup_date else "TBD"
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to send notification')
        )

    return {
        **result,
        "driver": {
            "id": driver.id,
            "name": f"{driver.first_name} {driver.last_name}",
            "phone": driver.phone
        },
        "load": {
            "id": load.id,
            "load_number": load.load_number
        }
    }


@router.post("/loads/update")
async def notify_load_update(
    request: LoadUpdateNotification,
    db: AsyncSession = Depends(get_db),
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send load update notification to driver
    """
    # Fetch driver
    driver_query = select(Driver).where(
        Driver.id == request.driver_id,
        Driver.company_id == current_user.company_id
    )
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if not driver.phone:
        raise HTTPException(status_code=400, detail="Driver has no phone number on file")

    # Fetch load
    load_query = select(Load).where(
        Load.id == request.load_id,
        Load.company_id == current_user.company_id
    )
    load_result = await db.execute(load_query)
    load = load_result.scalar_one_or_none()

    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Send notification
    result = await twilio_service.send_load_update_sms(
        driver_phone=driver.phone,
        driver_name=f"{driver.first_name} {driver.last_name}",
        load_number=load.load_number,
        update_message=request.update_message
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to send notification')
        )

    return {
        **result,
        "driver": {
            "id": driver.id,
            "name": f"{driver.first_name} {driver.last_name}",
            "phone": driver.phone
        },
        "load": {
            "id": load.id,
            "load_number": load.load_number
        }
    }


@router.post("/drivers/{driver_id}/notify")
async def notify_driver(
    driver_id: int,
    message: str,
    db: AsyncSession = Depends(get_db),
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send custom SMS notification to a specific driver
    """
    # Fetch driver
    driver_query = select(Driver).where(
        Driver.id == driver_id,
        Driver.company_id == current_user.company_id
    )
    driver_result = await db.execute(driver_query)
    driver = driver_result.scalar_one_or_none()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if not driver.phone:
        raise HTTPException(status_code=400, detail="Driver has no phone number on file")

    # Send notification
    result = await twilio_service.send_sms(
        to_phone=driver.phone,
        message=message
    )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get('error', 'Failed to send notification')
        )

    return {
        **result,
        "driver": {
            "id": driver.id,
            "name": f"{driver.first_name} {driver.last_name}",
            "phone": driver.phone
        }
    }


@router.post("/drivers/notify-all")
async def notify_all_drivers(
    message: str,
    db: AsyncSession = Depends(get_db),
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Send SMS notification to all drivers in the company

    Message template can include {name} placeholder
    """
    # Fetch all drivers with phone numbers
    query = select(Driver).where(
        Driver.company_id == current_user.company_id,
        Driver.phone.isnot(None)
    )
    result = await db.execute(query)
    drivers = result.scalars().all()

    if not drivers:
        raise HTTPException(status_code=404, detail="No drivers with phone numbers found")

    # Prepare recipients
    recipients = [
        {
            "phone": driver.phone,
            "name": f"{driver.first_name} {driver.last_name}"
        }
        for driver in drivers
    ]

    # Send bulk SMS
    bulk_result = await twilio_service.send_bulk_sms(
        recipients=recipients,
        message_template=message
    )

    return bulk_result


@router.get("/status")
async def get_twilio_status(
    twilio_service: TwilioService = Depends(get_twilio_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Check Twilio configuration status
    """
    return {
        "configured": bool(twilio_service.account_sid and twilio_service.auth_token),
        "phone_number": twilio_service.phone_number,
        "account_sid": twilio_service.account_sid[:8] + "..." if twilio_service.account_sid else None
    }
