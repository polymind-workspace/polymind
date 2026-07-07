"""PolyMind API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import models so Base.metadata knows about them.
import app.models  # noqa: F401
from app.core.config import settings
from app.lifespan import lifespan
from app.routers import api_router

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "polymind-api"}


@app.get("/api/v1/health")
async def api_health() -> dict:
    return {"status": "ok", "service": "polymind-api", "version": "v1"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
