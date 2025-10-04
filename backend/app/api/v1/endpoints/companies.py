from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, UserRole
from app.models.company import Company
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class CompanyResponse(BaseModel):
    """Company response schema"""
    id: int
    name: str
    mc_number: Optional[str]
    dot_number: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    phone: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True


class CompanyUpdate(BaseModel):
    """Company update schema"""
    name: Optional[str] = None
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


@router.get("/me", response_model=CompanyResponse)
async def get_my_company(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's company info"""
    query = select(Company).where(Company.id == current_user.company_id)
    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    return company


@router.put("/me", response_model=CompanyResponse)
async def update_my_company(
    company_data: CompanyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's company (admin only)"""

    # Check if user is admin
    if current_user.role not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update company information"
        )

    query = select(Company).where(Company.id == current_user.company_id)
    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    # Check if MC number is being changed and already exists
    if company_data.mc_number and company_data.mc_number != company.mc_number:
        query = select(Company).where(
            Company.mc_number == company_data.mc_number,
            Company.id != company.id
        )
        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MC number already registered to another company"
            )

    # Check if DOT number is being changed and already exists
    if company_data.dot_number and company_data.dot_number != company.dot_number:
        query = select(Company).where(
            Company.dot_number == company_data.dot_number,
            Company.id != company.id
        )
        result = await db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DOT number already registered to another company"
            )

    # Update company fields
    for field, value in company_data.model_dump(exclude_unset=True).items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)

    return company


@router.get("/")
async def get_companies():
    return {"message": "Get companies - to be implemented"}

@router.post("/")
async def create_company():
    return {"message": "Create company - to be implemented"}