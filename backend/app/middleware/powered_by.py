"""Middleware to add Fundrbolt powered-by header."""

from collections.abc import Callable
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class PoweredByMiddleware(BaseHTTPMiddleware):
    """Attach X-Powered-By header to all responses."""

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        self.header_value = "Fundrbolt Platform"

    async def dispatch(self, request: Request, call_next: Callable[..., Any]) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Powered-By"] = self.header_value
        return response
