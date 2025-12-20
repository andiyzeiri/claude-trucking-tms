"""
Dedicated Lane Scheduler Service

Generates loads from dedicated lane templates every Monday at midnight.
Loads are created for the following week (Monday to Sunday).
"""
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.dedicated_lane import DedicatedLane
from app.models.load import Load, LoadStatus

logger = logging.getLogger(__name__)


def get_next_week_date(day_of_week: int) -> datetime:
    """
    Get the date for a specific day of week in the NEXT week.
    day_of_week: 0=Monday, 6=Sunday

    If today is Monday, this returns the date for that day next week.
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    current_day = today.weekday()  # 0=Monday in Python

    # Days until next Monday (start of next week)
    days_until_next_monday = (7 - current_day) % 7
    if days_until_next_monday == 0:
        days_until_next_monday = 7  # If today is Monday, go to next Monday

    # Start of next week
    next_monday = today + timedelta(days=days_until_next_monday)

    # Add the day_of_week offset
    target_date = next_monday + timedelta(days=day_of_week)

    return target_date


def generate_load_number() -> str:
    """Generate a unique load number with timestamp."""
    timestamp = datetime.now().strftime('%y%m%d%H%M%S')
    return f"DL-{timestamp}"


async def generate_loads_from_dedicated_lanes():
    """
    Generate loads from all active dedicated lane templates.
    Called every Monday to create loads for the following week.
    """
    logger.info("Starting dedicated lane load generation...")

    # Create async engine and session
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            # Get all active dedicated lanes
            query = select(DedicatedLane).where(DedicatedLane.is_active == True)
            result = await session.execute(query)
            dedicated_lanes = result.scalars().all()

            logger.info(f"Found {len(dedicated_lanes)} active dedicated lanes")

            loads_created = 0
            for lane in dedicated_lanes:
                try:
                    # Calculate the pickup date for next week
                    pickup_date = get_next_week_date(lane.day_of_week)

                    # Add pickup time if specified
                    if lane.pickup_time:
                        pickup_date = pickup_date.replace(
                            hour=lane.pickup_time.hour,
                            minute=lane.pickup_time.minute
                        )

                    # Calculate delivery date (assume same day delivery by default)
                    delivery_date = pickup_date
                    if lane.delivery_time:
                        delivery_date = delivery_date.replace(
                            hour=lane.delivery_time.hour,
                            minute=lane.delivery_time.minute
                        )

                    # Check if a load already exists for this lane and date
                    existing_query = select(Load).where(
                        Load.company_id == lane.company_id,
                        Load.customer_id == lane.customer_id,
                        Load.pickup_location == lane.pickup_location,
                        Load.delivery_location == lane.delivery_location,
                        Load.pickup_date >= pickup_date.replace(hour=0, minute=0),
                        Load.pickup_date < pickup_date.replace(hour=23, minute=59),
                    )
                    existing_result = await session.execute(existing_query)
                    existing_load = existing_result.scalar_one_or_none()

                    if existing_load:
                        logger.info(f"Load already exists for dedicated lane {lane.id} on {pickup_date.date()}, skipping")
                        continue

                    # Create the load from the dedicated lane template
                    load = Load(
                        load_number=generate_load_number(),
                        reference_number=lane.reference_number,
                        pickup_location=lane.pickup_location,
                        delivery_location=lane.delivery_location,
                        miles=lane.miles,
                        rate=lane.rate,
                        carrier_rate=lane.carrier_rate,
                        fuel_surcharge=lane.fuel_surcharge,
                        accessorial_charges=lane.accessorial_charges,
                        pickup_date=pickup_date,
                        delivery_date=delivery_date,
                        pickup_notes=lane.pickup_notes,
                        delivery_notes=lane.delivery_notes,
                        status=LoadStatus.available,
                        company_id=lane.company_id,
                        customer_id=lane.customer_id,
                        driver_id=lane.driver_id,
                        truck_id=lane.truck_id,
                    )

                    session.add(load)
                    loads_created += 1
                    logger.info(f"Created load for dedicated lane '{lane.name}' (ID: {lane.id}) for {pickup_date.date()}")

                except Exception as e:
                    logger.error(f"Error creating load for dedicated lane {lane.id}: {e}")
                    continue

            await session.commit()
            logger.info(f"Successfully created {loads_created} loads from dedicated lanes")

    except Exception as e:
        logger.error(f"Error in dedicated lane load generation: {e}")
        raise
    finally:
        await engine.dispose()


async def run_scheduler():
    """Run the scheduler job manually (for testing or CLI invocation)."""
    await generate_loads_from_dedicated_lanes()


if __name__ == "__main__":
    # Allow running this script directly for testing
    asyncio.run(run_scheduler())
