from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_stops():
    return {"message": "Get stops - to be implemented"}

@router.post("/")
async def create_stop():
    return {"message": "Create stop - to be implemented"}