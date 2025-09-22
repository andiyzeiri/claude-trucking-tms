from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_invoices():
    return {"message": "Get invoices - to be implemented"}

@router.post("/")
async def create_invoice():
    return {"message": "Create invoice - to be implemented"}