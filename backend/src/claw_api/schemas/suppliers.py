from pydantic import BaseModel, EmailStr


class SupplierCreate(BaseModel):
    display_name: str
    payout_email: EmailStr


class SupplierOut(BaseModel):
    id: str
    display_name: str
    payout_email: EmailStr

    model_config = {"from_attributes": True}
