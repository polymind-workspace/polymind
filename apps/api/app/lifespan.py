from contextlib import asynccontextmanager

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan.

    Database tables are managed by Alembic migrations. Run:
        uv run alembic upgrade head
    before starting the server.
    """
    yield
