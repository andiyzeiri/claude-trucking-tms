from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import List, Optional
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Absolute TMS API",
    version="1.0.0",
    description="Multi-tenant Transportation Management System API"
)

# CORS middleware - update with your Netlify URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://*.netlify.app",  # Netlify apps
        "https://your-custom-domain.com",  # Your custom domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data matching your frontend structure
MOCK_LOADS = [
    {
        "id": 1,
        "load_number": "TMS001",
        "customer": "ABC Logistics",
        "driver": "John Smith",
        "pickup_location": "Los Angeles, CA",
        "delivery_location": "Phoenix, AZ",
        "pickup_date": "2025-01-15",
        "delivery_date": "2025-01-17",
        "rate": 2500.00,
        "miles": 385,
        "status": "in_transit"
    },
    {
        "id": 2,
        "load_number": "TMS002",
        "customer": "XYZ Shipping",
        "driver": "Jane Doe",
        "pickup_location": "Dallas, TX",
        "delivery_location": "Houston, TX",
        "pickup_date": "2025-01-14",
        "delivery_date": "2025-01-15",
        "rate": 1200.00,
        "miles": 240,
        "status": "delivered"
    },
    {
        "id": 3,
        "load_number": "TMS003",
        "customer": "Fast Freight Co",
        "driver": "Robert Wilson",
        "pickup_location": "Chicago, IL",
        "delivery_location": "Milwaukee, WI",
        "pickup_date": "2025-01-16",
        "delivery_date": "2025-01-17",
        "rate": 800.00,
        "miles": 92,
        "status": "booked"
    }
]

MOCK_DRIVERS = [
    {
        "id": 1,
        "name": "John Smith",
        "email": "john.smith@acme.com",
        "phone": "(555) 123-1111",
        "license": "DL123456789",
        "type": "company",
        "status": "active",
        "truck": "Peterbilt 579 #101"
    },
    {
        "id": 2,
        "name": "Jane Doe",
        "email": "jane.doe@acme.com",
        "phone": "(555) 123-2222",
        "license": "DL987654321",
        "type": "company",
        "status": "active",
        "truck": "Kenworth T680 #102"
    },
    {
        "id": 3,
        "name": "Robert Wilson",
        "email": "robert@gmail.com",
        "phone": "(555) 123-3333",
        "license": "DL456789123",
        "type": "owner_operator",
        "status": "active",
        "truck": "Owner Truck"
    }
]

MOCK_CUSTOMERS = [
    {
        "id": 1,
        "name": "ABC Logistics",
        "contact_person": "Tom Anderson",
        "email": "tom@abclogistics.com",
        "phone": "(555) 123-4567",
        "mc_number": "MC-123456",
        "payment_terms": "NET30"
    },
    {
        "id": 2,
        "name": "XYZ Shipping",
        "contact_person": "Mary Johnson",
        "email": "mary@xyzship.com",
        "phone": "(555) 987-6543",
        "mc_number": "MC-789012",
        "payment_terms": "NET15"
    }
]

@app.get("/")
async def root():
    return {"message": "Absolute TMS API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Absolute TMS API is running"}

@app.get("/api/loads")
async def get_loads():
    """Get all loads"""
    logger.info("Fetching all loads")
    return MOCK_LOADS

@app.get("/api/loads/{load_id}")
async def get_load(load_id: int):
    """Get a specific load by ID"""
    load = next((load for load in MOCK_LOADS if load["id"] == load_id), None)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    return load

@app.get("/api/drivers")
async def get_drivers():
    """Get all drivers"""
    logger.info("Fetching all drivers")
    return MOCK_DRIVERS

@app.get("/api/drivers/{driver_id}")
async def get_driver(driver_id: int):
    """Get a specific driver by ID"""
    driver = next((driver for driver in MOCK_DRIVERS if driver["id"] == driver_id), None)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@app.get("/api/customers")
async def get_customers():
    """Get all customers"""
    logger.info("Fetching all customers")
    return MOCK_CUSTOMERS

@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: int):
    """Get a specific customer by ID"""
    customer = next((customer for customer in MOCK_CUSTOMERS if customer["id"] == customer_id), None)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

# Authentication endpoints (mock for now)
@app.post("/api/auth/login")
async def login(credentials: dict):
    """Mock login endpoint"""
    # In real implementation, validate credentials against database
    return {
        "access_token": "mock_token_123",
        "token_type": "bearer",
        "user": {
            "id": 1,
            "email": "admin@acme.com",
            "first_name": "John",
            "last_name": "Admin",
            "role": "admin"
        }
    }

@app.get("/api/auth/me")
async def get_current_user():
    """Get current user info"""
    return {
        "id": 1,
        "email": "admin@acme.com",
        "first_name": "John",
        "last_name": "Admin",
        "role": "admin",
        "tenant": "acme-trucking"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)