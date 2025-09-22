from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, companies, customers, trucks, drivers, loads, stops, invoices

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