from pydantic import BaseModel, EmailStr, Field


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerify(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    wallet_address: str | None = None

    model_config = {"from_attributes": True}


class WalletUpdate(BaseModel):
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
