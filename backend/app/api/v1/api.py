from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, companies, customers, trucks, drivers, loads, stops, invoices, payroll, lanes, expenses, uploads, shippers, receivers, notifications, ratecons

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(trucks.router, prefix="/trucks", tags=["trucks"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
api_router.include_router(loads.router, prefix="/loads", tags=["loads"])
api_router.include_router(stops.router, prefix="/stops", tags=["stops"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["payroll"])
api_router.include_router(lanes.router, prefix="/lanes", tags=["lanes"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(shippers.router, prefix="/shippers", tags=["shippers"])
api_router.include_router(receivers.router, prefix="/receivers", tags=["receivers"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(ratecons.router, prefix="/ratecons", tags=["ratecons"])