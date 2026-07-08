"""Unified API response helpers."""

from typing import Any


def success(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    """Return a successful response envelope."""
    return {"ret": 200, "msg": msg, "data": data}


def fail(ret: int, msg: str, data: Any = None) -> dict[str, Any]:
    """Return a failed response envelope.

    `ret` is the business status code exposed to clients.
    `data` may carry extra context for the caller.
    """
    return {"ret": ret, "msg": msg, "data": data}
