from pydantic import BaseModel, EmailStr, Field

WALLET_PATTERN = r"^0x[0-9a-fA-F]{40}$"


class SupplierCreate(BaseModel):
    display_name: str
    payout_email: EmailStr
    payout_wallet: str | None = Field(default=None, pattern=WALLET_PATTERN)


class SupplierUpdate(BaseModel):
    payout_wallet: str = Field(pattern=WALLET_PATTERN)


class SupplierOut(BaseModel):
    id: str
    display_name: str
    payout_email: EmailStr
    payout_wallet: str | None = None

    model_config = {"from_attributes": True}
