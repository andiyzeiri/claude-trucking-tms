from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_customers():
    return {"message": "Get customers - to be implemented"}

@router.post("/")
async def create_customer():
    return {"message": "Create customer - to be implemented"}