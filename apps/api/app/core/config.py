from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "PolyMind API"
    app_version: str = "0.1.0"
    debug: bool = False

    api_host: str = "0.0.0.0"
    api_port: int = 8300

    # PostgreSQL is the default and only supported database.
    # Use the Docker Compose service (db) on port 5433.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/polymind"
    database_echo: bool = False

    cors_origins: str = "http://localhost:3100,http://127.0.0.1:3100"

    # Solana
    solana_cluster: str = "devnet"
    solana_rpc_url: str = "https://api.devnet.solana.com"
    solana_program_id: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
