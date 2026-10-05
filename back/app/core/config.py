from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Foot Easy API"
    environment: str = "local"
    # Credentials come only from the DATABASE_URL environment variable.
    database_url: str = "postgresql+asyncpg://localhost:5432/foot_easy"
    cors_origins: list[str] = ["http://foot-easy.localhost", "http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
