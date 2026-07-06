from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="dev")
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_user_ttl_hours: int = 24
    jwt_worker_ttl_days: int = 30
    magic_link_ttl_minutes: int = 15
    magic_link_delivery: str = "console"

    # --- on-chain settlement (ClawEscrow) -------------------------------
    # Off by default: bookings settle off-chain unless this is configured.
    chain_enabled: bool = False
    chain_rpc_url: str = "https://rpc.testnet.arc.network"
    chain_id: int = 5042002  # Arc testnet
    chain_explorer_url: str = "https://testnet.arcscan.app"
    chain_name: str = "Arc Testnet"
    chain_escrow_address: str = ""
    chain_usdc_address: str = "0x3600000000000000000000000000000000000000"
    # Settler service key — env only (CHAIN_SETTLER_KEY), never logged.
    chain_settler_key: str = ""
    chain_commission_bps: int = 1500
    # Worst-case booking window locked in escrow at activation.
    chain_max_booking_hours: int = 8


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
