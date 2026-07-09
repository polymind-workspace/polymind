from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan.

    Database tables are managed by Alembic migrations. Run:
        uv run alembic upgrade head
    before starting the server.
    """
    settings.require_jwt_secrets()
    yield


__all__ = ["lifespan"]
