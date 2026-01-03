from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from datetime import date
from typing import List, Optional

from app.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.driver_day_note import DriverDayNote

router = APIRouter()


class DayNoteCreate(BaseModel):
    driver_id: int
    date: date
    note: str


class DayNoteResponse(BaseModel):
    id: int
    driver_id: int
    date: date
    note: str
    company_id: int

    class Config:
        from_attributes = True


@router.get("/", response_model=List[DayNoteResponse])
async def get_day_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all day notes for the current company"""
    query = select(DriverDayNote).where(
        DriverDayNote.company_id == current_user.company_id
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=DayNoteResponse)
async def create_or_update_note(
    note_data: DayNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create or update a note for a driver on a specific date"""
    # Check if note already exists
    query = select(DriverDayNote).where(
        DriverDayNote.driver_id == note_data.driver_id,
        DriverDayNote.date == note_data.date,
        DriverDayNote.company_id == current_user.company_id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing note
        if note_data.note.strip():
            existing.note = note_data.note.strip()
            await db.commit()
            await db.refresh(existing)
            return existing
        else:
            # Empty note = delete
            await db.delete(existing)
            await db.commit()
            raise HTTPException(status_code=204, detail="Note deleted")
    else:
        # Create new note (only if not empty)
        if not note_data.note.strip():
            raise HTTPException(status_code=400, detail="Note cannot be empty")

        new_note = DriverDayNote(
            driver_id=note_data.driver_id,
            date=note_data.date,
            note=note_data.note.strip(),
            company_id=current_user.company_id
        )
        db.add(new_note)
        await db.commit()
        await db.refresh(new_note)
        return new_note


@router.delete("/{driver_id}/{date_str}")
async def delete_note(
    driver_id: int,
    date_str: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a specific note"""
    note_date = date.fromisoformat(date_str)
    query = delete(DriverDayNote).where(
        DriverDayNote.driver_id == driver_id,
        DriverDayNote.date == note_date,
        DriverDayNote.company_id == current_user.company_id
    )
    await db.execute(query)
    await db.commit()
    return {"status": "deleted"}
