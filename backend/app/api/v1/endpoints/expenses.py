from typing import List
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[ExpenseResponse])
async def get_expenses(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Expense)
        .options(selectinload(Expense.driver), selectinload(Expense.truck))
        .where(Expense.company_id == current_user.company_id)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    expenses = result.scalars().all()
    return expenses


@router.post("/", response_model=ExpenseResponse)
async def create_expense(
    expense: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_expense = Expense(**expense.dict(), company_id=current_user.company_id)
    db.add(db_expense)
    await db.commit()
    await db.refresh(db_expense)
    return db_expense


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Expense)
        .options(selectinload(Expense.driver), selectinload(Expense.truck))
        .where(
            Expense.id == expense_id,
            Expense.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Expense)
        .options(selectinload(Expense.driver), selectinload(Expense.truck))
        .where(
            Expense.id == expense_id,
            Expense.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    update_data = expense_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        # Convert date strings to date objects
        if field == 'date' and isinstance(value, str):
            value = date.fromisoformat(value)
        # Convert amount strings to Decimal
        if field == 'amount' and value is not None:
            from decimal import Decimal
            value = Decimal(str(value))
        setattr(expense, field, value)

    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Expense).where(
        Expense.id == expense_id,
        Expense.company_id == current_user.company_id
    )
    result = await db.execute(query)
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    await db.delete(expense)
    await db.commit()
    return {"message": "Expense deleted successfully"}


@router.post("/generate-recurring")
async def generate_recurring_expenses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Generate any due recurring expenses from templates."""
    today = date.today()

    # Get all templates for this company
    query = select(Expense).where(
        Expense.company_id == current_user.company_id,
        Expense.is_template == True,
        Expense.frequency.isnot(None)
    )
    result = await db.execute(query)
    templates = result.scalars().all()

    created = 0
    for template in templates:
        if not template.frequency or not template.pay_day:
            continue

        # Determine the next due date
        if template.frequency == 'weekly':
            # pay_day = 1 (Monday) to 7 (Sunday)
            days_ahead = template.pay_day - today.isoweekday()
            if days_ahead < 0:
                days_ahead += 7
            next_due = today + timedelta(days=days_ahead)
            # If today is the pay day, use today
            if today.isoweekday() == template.pay_day:
                next_due = today
        elif template.frequency == 'monthly':
            # pay_day = day of month (1-31)
            try:
                next_due = today.replace(day=template.pay_day)
                if next_due < today:
                    next_due = (today + relativedelta(months=1)).replace(day=template.pay_day)
            except ValueError:
                # Day doesn't exist in this month (e.g., 31st in February)
                next_due = (today + relativedelta(months=1)).replace(day=template.pay_day)
        elif template.frequency == 'yearly':
            # pay_day = day of year (use month from template date)
            next_due = template.date.replace(year=today.year)
            if next_due < today:
                next_due = template.date.replace(year=today.year + 1)
        else:
            continue

        # Only create if due today
        if next_due != today:
            continue

        # Check if already created today for this template
        existing_query = select(Expense).where(
            Expense.template_id == template.id,
            Expense.date == today
        )
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            continue

        # Create the expense entry
        new_expense = Expense(
            date=today,
            category=template.category,
            cost_type=template.cost_type,
            expense_group=template.expense_group,
            description=template.description,
            amount=template.amount,
            vendor=template.vendor,
            payment_method=template.payment_method,
            company_id=template.company_id,
            driver_id=template.driver_id,
            truck_id=template.truck_id,
            is_template=False,
            template_id=template.id
        )
        db.add(new_expense)
        created += 1

    await db.commit()
    return {"message": f"Generated {created} recurring expenses"}
