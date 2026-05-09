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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
