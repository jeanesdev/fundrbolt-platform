"""Custom error handlers and exceptions."""

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AuthenticationError(HTTPException):
    """Raised when authentication fails."""

    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthorizationError(HTTPException):
    """Raised when user lacks required permissions."""

    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class ResourceNotFoundError(HTTPException):
    """Raised when a requested resource doesn't exist."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} with identifier '{identifier}' not found",
        )


class DuplicateResourceError(HTTPException):
    """Raised when trying to create a resource that already exists."""

    def __init__(self, resource: str, field: str, value: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{resource} with {field}='{value}' already exists",
        )


class RateLimitError(HTTPException):
    """Raised when rate limit is exceeded."""

    def __init__(self, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


class NotFoundError(HTTPException):
    """Raised when a resource is not found."""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class ValidationError(HTTPException):
    """Raised when validation fails."""

    def __init__(self, detail: str = "Validation failed"):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTPException and return JSON response.

    Args:
        request: FastAPI request
        exc: HTTPException

    Returns:
        JSONResponse: Formatted error response
    """
    # Use FastAPI's standard 'detail' key for consistency with validation errors
    # If detail is already structured, use it; otherwise wrap it
    if isinstance(exc.detail, dict):
        content = {"detail": exc.detail}
    else:
        content = {"detail": {"code": exc.status_code, "message": str(exc.detail)}}

    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic ValidationError and return JSON response.

    Args:
        request: FastAPI request
        exc: RequestValidationError from FastAPI

    Returns:
        JSONResponse: Formatted validation error response
    """
    errors = []
    for error in exc.errors():
        errors.append(
            {
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
        )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": "Validation error",
                "type": "ValidationError",
                "details": errors,
            }
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions and return JSON response.

    Args:
        request: FastAPI request
        exc: Exception

    Returns:
        JSONResponse: Formatted error response
    """
    # Log the exception (will be handled by logging middleware)
    import traceback

    traceback.print_exc()

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": {
                "code": 500,
                "message": "Internal server error",
                "type": "InternalServerError",
            }
        },
    )
