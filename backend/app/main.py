from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Claude Trucking TMS API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Demo endpoints for development
@app.get("/api/v1/demo/loads")
async def demo_loads():
    return {
        "total": 5,
        "items": [
            {
                "id": 1,
                "load_number": "TMS001",
                "pickup_location": "Los Angeles, CA",
                "delivery_location": "Phoenix, AZ",
                "status": "in_transit",
                "rate": 2500.00
            },
            {
                "id": 2,
                "load_number": "TMS002",
                "pickup_location": "Dallas, TX",
                "delivery_location": "Houston, TX",
                "status": "delivered",
                "rate": 1200.00
            },
            {
                "id": 3,
                "load_number": "TMS003",
                "pickup_location": "Chicago, IL",
                "delivery_location": "Milwaukee, WI",
                "status": "assigned",
                "rate": 800.00
            }
        ]
    }


@app.get("/api/v1/demo/drivers")
async def demo_drivers():
    return {
        "total": 3,
        "items": [
            {"id": 1, "name": "John Smith", "status": "available"},
            {"id": 2, "name": "Jane Doe", "status": "available"},
            {"id": 3, "name": "Mike Wilson", "status": "on_trip"}
        ]
    }


@app.get("/api/v1/demo/trucks")
async def demo_trucks():
    return {
        "total": 4,
        "items": [
            {"id": 1, "unit_number": "T001", "status": "available"},
            {"id": 2, "unit_number": "T002", "status": "available"},
            {"id": 3, "unit_number": "T003", "status": "in_maintenance"},
            {"id": 4, "unit_number": "T004", "status": "available"}
        ]
    }


@app.get("/api/v1/demo/customers")
async def demo_customers():
    return {
        "total": 3,
        "items": [
            {"id": 1, "name": "ABC Logistics", "status": "active"},
            {"id": 2, "name": "XYZ Shipping", "status": "active"},
            {"id": 3, "name": "Global Transport", "status": "inactive"}
        ]
    }


# Demo auth endpoints
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends

@app.post("/api/v1/demo/auth/login")
async def demo_login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Accept any credentials for demo
    if form_data.username and form_data.password:
        return {
            "access_token": "demo_token_123",
            "token_type": "bearer"
        }
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid credentials")


@app.get("/api/v1/demo/auth/me")
async def demo_me():
    return {
        "id": 1,
        "email": "admin@example.com",
        "name": "Demo Admin",
        "company_id": 1
    }