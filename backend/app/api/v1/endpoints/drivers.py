from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_drivers():
    return {"message": "Get drivers - to be implemented"}

@router.post("/")
async def create_driver():
    return {"message": "Create driver - to be implemented"}