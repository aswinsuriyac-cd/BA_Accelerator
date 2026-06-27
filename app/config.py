from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    gemini_api_key: Optional[str] = None
    database_url: str = "sqlite:///./ba_accelerator.db"
    storage_root: str = "storage"
    port: int = 8000
    host: str = "0.0.0.0"
    model_name: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
