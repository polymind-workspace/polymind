"""PolyMind API."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Import models so Base.metadata knows about them.
import app.models  # noqa: F401
from app.core.config import settings
from app.core.exceptions import APIError
from app.core.logging import configure_logging
from app.core.response import fail
from app.lifespan import lifespan
from app.middleware.logging import RequestLoggingMiddleware
from app.routers import api_router

configure_logging("DEBUG" if settings.debug else "INFO")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

# Request logging must run before CORS so the response header is attached before
# CORS middleware finalizes the response.
app.add_middleware(RequestLoggingMiddleware)

# Serve uploaded media files. In production this is usually handled by a CDN
# or object storage; the local directory mount is for MVP development.
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount(settings.upload_url_prefix, StaticFiles(directory=settings.upload_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


@app.exception_handler(APIError)
async def api_exception_handler(request: Request, exc: APIError) -> JSONResponse:
    """Return business exceptions in the unified envelope format."""
    return JSONResponse(
        status_code=exc.status_code,
        content=fail(exc.ret, exc.msg),
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected errors."""
    import structlog

    logger = structlog.get_logger()
    logger.exception("unhandled_error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=fail(500, "internal server error"),
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
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
