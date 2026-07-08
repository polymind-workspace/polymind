"""Application-specific exceptions."""


class APIError(Exception):
    """Business exception that maps to a client-facing response envelope.

    Attributes:
        ret: Business status code (e.g. 400, 404).
        msg: Human-readable message.
        status_code: HTTP status code.
    """

    def __init__(self, ret: int, msg: str, status_code: int = 400) -> None:
        self.ret = ret
        self.msg = msg
        self.status_code = status_code
        super().__init__(msg)


class BadRequestError(APIError):
    def __init__(self, msg: str = "bad request") -> None:
        super().__init__(400, msg, 400)


class NotFoundError(APIError):
    def __init__(self, msg: str = "not found") -> None:
        super().__init__(404, msg, 404)


class UnauthorizedError(APIError):
    def __init__(self, msg: str = "unauthorized") -> None:
        super().__init__(401, msg, 401)


class ForbiddenError(APIError):
    def __init__(self, msg: str = "forbidden") -> None:
        super().__init__(403, msg, 403)
