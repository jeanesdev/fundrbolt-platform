"""Rate limiting middleware for FastAPI endpoints.

Provides decorators and dependencies for rate limiting using Redis.
"""

from collections.abc import Awaitable, Callable
from datetime import datetime
from functools import wraps
from typing import Any, ParamSpec, TypeVar

from fastapi import HTTPException, Request, status
from redis.exceptions import ResponseError

from app.core.redis import get_redis
from app.services.redis_service import RedisService

P = ParamSpec("P")
T = TypeVar("T")


class RateLimiter:
    """Rate limiting utility using Redis for distributed rate limiting.

    Uses Redis counters with expiration for simple and efficient rate limiting.
    """

    def __init__(
        self,
        max_requests: int,
        window_seconds: int,
        key_prefix: str = "rate_limit",
    ):
        """Initialize rate limiter.

        Args:
            max_requests: Maximum number of requests allowed in window
            window_seconds: Time window in seconds
            key_prefix: Redis key prefix for rate limit keys
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        self.redis_service = RedisService()

    def get_rate_limit_key(self, identifier: str) -> str:
        """Generate Redis key for rate limit tracking.

        Args:
            identifier: Unique identifier (e.g., IP address, user ID, API key)

        Returns:
            Redis key string
        """
        return f"{self.key_prefix}:{identifier}"

    async def is_rate_limited(self, identifier: str) -> bool:
        """Check if identifier has exceeded rate limit.

        Args:
            identifier: Unique identifier to check

        Returns:
            True if rate limited, False otherwise
        """
        key = self.get_rate_limit_key(identifier)
        return await self.redis_service.check_rate_limit(
            key=key,
            max_attempts=self.max_requests,
            window_seconds=self.window_seconds,
        )

    async def get_remaining_requests(self, identifier: str) -> tuple[int, int]:
        """Get remaining requests and time until reset.

        Args:
            identifier: Unique identifier to check

        Returns:
            Tuple of (remaining_requests, seconds_until_reset)
        """
        key = self.get_rate_limit_key(identifier)
        now = datetime.utcnow().timestamp()
        window_start = now - self.window_seconds

        redis_client = await get_redis()

        # Sliding-window rate limits are stored as sorted sets. Fall back to
        # string counters if any legacy keys still exist.
        try:
            await redis_client.zremrangebyscore(key, 0, window_start)
            count = await redis_client.zcount(key, window_start, now)
        except ResponseError:
            count = await self._get_legacy_or_reset_count(redis_client, key)

        # Get TTL
        ttl = await redis_client.ttl(key)
        seconds_until_reset = ttl if ttl > 0 else self.window_seconds

        remaining = max(0, self.max_requests - count)

        return remaining, seconds_until_reset

    async def _get_legacy_or_reset_count(
        self,
        redis_client: Any,
        key: str,
    ) -> int:
        """Read legacy string counters or clear malformed keys.

        Older deployments may still have non-zset rate-limit keys in Redis.
        Treat legacy string counters as valid, but clear any other unexpected
        key types so requests recover instead of returning a 500.
        """

        key_type = await redis_client.type(key)
        if isinstance(key_type, bytes):
            key_type = key_type.decode()

        if key_type == "string":
            try:
                current_count = await redis_client.get(key)
            except ResponseError:
                await redis_client.delete(key)
                return 0

            if current_count is None:
                return 0

            try:
                return int(current_count)
            except (TypeError, ValueError):
                await redis_client.delete(key)
                return 0

        if key_type not in {"none", "string", "zset"}:
            await redis_client.delete(key)

        return 0


def rate_limit(
    max_requests: int = 5,
    window_seconds: int = 900,  # 15 minutes
    key_func: Callable[[Request], str] | None = None,
) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Decorator for rate limiting FastAPI endpoints.

    Args:
        max_requests: Maximum requests allowed in window (default: 5)
        window_seconds: Time window in seconds (default: 900 = 15 minutes)
        key_func: Optional function to extract identifier from request
                  (default: uses IP address)

    Returns:
        Decorator function

    Usage:
        @router.post("/login")
        @rate_limit(max_requests=5, window_seconds=900)
        async def login(request: Request):
            # Endpoint logic
            pass

    Raises:
        HTTPException 429: Rate limit exceeded
    """

    def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract request object from args or kwargs
            request: Request | None = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")

            if not request:
                # If no request object, skip rate limiting
                return await func(*args, **kwargs)

            # Get identifier (IP address or custom key)
            if key_func:
                identifier = key_func(request)
            else:
                identifier = request.client.host if request.client else "unknown"

            # Check rate limit
            limiter = RateLimiter(
                max_requests=max_requests,
                window_seconds=window_seconds,
                key_prefix=f"rate_limit:{func.__module__}.{func.__name__}",
            )

            if await limiter.is_rate_limited(identifier):
                remaining, seconds_until_reset = await limiter.get_remaining_requests(identifier)

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": (
                                f"Too many requests. "
                                f"Please try again in {seconds_until_reset} seconds."
                            ),
                            "details": {
                                "retry_after_seconds": seconds_until_reset,
                                "limit": max_requests,
                                "window_seconds": window_seconds,
                            },
                        }
                    },
                    headers={
                        "Retry-After": str(seconds_until_reset),
                        "X-RateLimit-Limit": str(max_requests),
                        "X-RateLimit-Remaining": str(remaining),
                        "X-RateLimit-Reset": str(seconds_until_reset),
                    },
                )

            # Execute endpoint
            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Pre-configured rate limiters for common use cases
def login_rate_limit() -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Rate limiter for login endpoints (5 attempts per 15 minutes)."""
    return rate_limit(max_requests=5, window_seconds=900)


def password_reset_rate_limit() -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Rate limiter for password reset endpoints (3 attempts per hour)."""
    return rate_limit(max_requests=3, window_seconds=3600)


def api_rate_limit() -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Rate limiter for general API endpoints (100 requests per minute)."""
    return rate_limit(max_requests=100, window_seconds=60)


def strict_rate_limit() -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Strict rate limiter for sensitive endpoints (2 attempts per hour)."""
    return rate_limit(max_requests=2, window_seconds=3600)
