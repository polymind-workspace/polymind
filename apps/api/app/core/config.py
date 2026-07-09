from pathlib import Path

from pydantic import field_validator
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

    # Auth
    jwt_secret: str = ""
    admin_jwt_secret: str = ""
    nonce_ttl_seconds: int = 300

    # Admin bootstrap
    backend_admin_bootstrap: str = ""

    @field_validator("jwt_secret", "admin_jwt_secret")
    @classmethod
    def _validate_jwt_secret(cls, value: str) -> str:
        if value and len(value.strip()) >= 32:
            return value.strip()
        # Allow empty in debug mode; production will fail at runtime check.
        return value.strip()

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def require_jwt_secrets(self) -> None:
        """Fail-closed check for production environments."""
        if self.debug:
            return
        secrets = [
            ("jwt_secret", self.jwt_secret),
            ("admin_jwt_secret", self.admin_jwt_secret),
        ]
        for name, value in secrets:
            if not value or len(value.strip()) < 32:
                raise RuntimeError(
                    f"{name} must be set to a strong random value (>=32 chars). "
                    "Refusing to start with a missing or weak secret."
                )


settings = Settings()
