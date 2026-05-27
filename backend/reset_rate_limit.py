#!/usr/bin/env python3
"""Reset rate limit for login attempts."""

import asyncio

from app.services.redis_service import get_redis


async def reset_login_rate_limits():
    """Reset all login rate limit keys."""
    redis = await get_redis()
    pattern = "login_attempt:*"

    # Get all matching keys
    keys = []
    cursor = 0
    while True:
        cursor, batch = await redis.scan(cursor, match=pattern, count=100)
        keys.extend(batch)
        if cursor == 0:
            break

    print(f"Found {len(keys)} rate limit keys")

    if keys:
        # Delete all matching keys
        await redis.delete(*keys)
        print(f"Deleted {len(keys)} rate limit keys")
    else:
        print("No rate limit keys found")

    await redis.close()


if __name__ == "__main__":
    asyncio.run(reset_login_rate_limits())
