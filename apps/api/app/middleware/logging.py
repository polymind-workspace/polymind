"""Request logging middleware."""

import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from structlog import get_logger

logger = get_logger()

REQUEST_ID_HEADER = "X-Request-ID"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Attach a request_id to every request and log method/path/status/duration."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER.lower()) or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        response.headers[REQUEST_ID_HEADER] = request_id

        logger.info(
            "request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            query=str(request.query_params),
            status=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response
