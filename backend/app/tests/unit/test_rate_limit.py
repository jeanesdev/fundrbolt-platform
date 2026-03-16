"""Unit tests for Redis-backed rate-limit recovery behavior."""

from unittest.mock import AsyncMock, patch

import pytest
from redis.exceptions import ResponseError

from app.middleware.rate_limit import RateLimiter
from app.services.redis_service import RedisService


@pytest.mark.asyncio
async def test_get_remaining_requests_resets_malformed_key() -> None:
    """Malformed Redis key types should not crash rate-limit reads."""
    redis_client = AsyncMock()
    redis_client.zremrangebyscore.side_effect = ResponseError("WRONGTYPE")
    redis_client.type.return_value = "hash"
    redis_client.delete.return_value = 1
    redis_client.ttl.return_value = -2

    limiter = RateLimiter(max_requests=5, window_seconds=3600)

    with patch("app.middleware.rate_limit.get_redis", AsyncMock(return_value=redis_client)):
        remaining, seconds_until_reset = await limiter.get_remaining_requests("127.0.0.1")

    assert remaining == 5
    assert seconds_until_reset == 3600
    redis_client.delete.assert_awaited_once_with("rate_limit:127.0.0.1")


@pytest.mark.asyncio
async def test_check_rate_limit_recreates_wrongtype_key_as_zset() -> None:
    """Malformed Redis key types should be cleared before sliding-window writes."""
    redis_client = AsyncMock()
    redis_client.zremrangebyscore.side_effect = ResponseError("WRONGTYPE")
    redis_client.delete.return_value = 1
    redis_client.zadd.return_value = 1
    redis_client.expire.return_value = True

    with patch("app.services.redis_service.get_redis", AsyncMock(return_value=redis_client)):
        is_limited = await RedisService.check_rate_limit(
            key="rate_limit:test",
            max_attempts=5,
            window_seconds=3600,
        )

    assert is_limited is False
    redis_client.delete.assert_awaited_once_with("rate_limit:test")
    redis_client.zadd.assert_awaited_once()
    redis_client.expire.assert_awaited_once_with("rate_limit:test", 3600)
