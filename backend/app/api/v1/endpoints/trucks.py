from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_trucks():
    return {"message": "Get trucks - to be implemented"}

@router.post("/")
async def create_truck():
    return {"message": "Create truck - to be implemented"}