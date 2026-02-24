"""Redis service for session storage, token blacklisting, and caching."""

import json
import uuid
from datetime import datetime
from typing import Any

from app.core.redis import get_redis


class RedisService:
    """Service for Redis operations.

    Handles:
    - Active session storage (7-day TTL)
    - JWT blacklist for revoked access tokens (15-min TTL)
    - Email verification tokens (24-hour TTL)
    - Password reset tokens (1-hour TTL)
    - Rate limiting (15-min sliding window)
    """

    # TTL constants (in seconds)
    SESSION_TTL = 604800  # 7 days
    ACCESS_TOKEN_TTL = 900  # 15 minutes
    EMAIL_VERIFY_TTL = 86400  # 24 hours
    PASSWORD_RESET_TTL = 3600  # 1 hour
    RATE_LIMIT_TTL = 900  # 15 minutes

    @staticmethod
    async def set_session(
        user_id: uuid.UUID,
        jti: str,
        device_info: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Store active session in Redis.

        Key: session:{user_id}:{jti}
        Value: JSON with session metadata
        TTL: 7 days (matches refresh token expiry)

        Args:
            user_id: User UUID
            jti: JWT ID from refresh token
            device_info: Optional device information
            ip_address: Optional IP address
        """
        redis = await get_redis()
        key = f"session:{user_id}:{jti}"

        session_data = {
            "user_id": str(user_id),
            "jti": jti,
            "device": device_info,
            "ip": ip_address,
            "created_at": datetime.utcnow().isoformat(),
        }

        await redis.setex(
            key,
            RedisService.SESSION_TTL,
            json.dumps(session_data),
        )

    @staticmethod
    async def get_session(user_id: uuid.UUID, jti: str) -> dict[str, Any] | None:
        """Retrieve active session from Redis.

        Args:
            user_id: User UUID
            jti: JWT ID from refresh token

        Returns:
            Session data dict if exists, None otherwise
        """
        redis = await get_redis()
        key = f"session:{user_id}:{jti}"

        data = await redis.get(key)
        if data is None:
            return None

        result: dict[str, Any] = json.loads(data)
        return result

    @staticmethod
    async def delete_session(user_id: uuid.UUID, jti: str) -> None:
        """Delete session from Redis (logout).

        Args:
            user_id: User UUID
            jti: JWT ID from refresh token
        """
        redis = await get_redis()
        key = f"session:{user_id}:{jti}"
        await redis.delete(key)

    @staticmethod
    async def delete_all_user_sessions(user_id: uuid.UUID) -> int:
        """Delete all sessions for a user (password reset, account deactivation).

        Args:
            user_id: User UUID

        Returns:
            Number of sessions deleted
        """
        redis = await get_redis()
        pattern = f"session:{user_id}:*"

        # Find all matching keys
        keys = []
        async for key in redis.scan_iter(match=pattern):
            keys.append(key)

        # Delete all found keys
        if keys:
            return await redis.delete(*keys)
        return 0

    @staticmethod
    async def blacklist_token(jti: str) -> None:
        """Add access token to blacklist (used during logout).

        Key: blacklist:{jti}
        Value: 1
        TTL: 15 minutes (access token expiry)

        Args:
            jti: JWT ID from access token
        """
        redis = await get_redis()
        key = f"blacklist:{jti}"
        await redis.setex(key, RedisService.ACCESS_TOKEN_TTL, "1")

    @staticmethod
    async def is_token_blacklisted(jti: str) -> bool:
        """Check if access token is blacklisted.

        Args:
            jti: JWT ID from access token

        Returns:
            True if token is blacklisted
        """
        redis = await get_redis()
        key = f"blacklist:{jti}"
        result = await redis.exists(key)
        return result > 0

    @staticmethod
    async def store_email_verification_token(token: str, user_id: uuid.UUID) -> None:
        """Store email verification token.

        Key: email_verify:{token}
        Value: user_id (UUID as string)
        TTL: 24 hours

        Args:
            token: Verification token
            user_id: User UUID
        """
        redis = await get_redis()
        key = f"email_verify:{token}"
        await redis.setex(key, RedisService.EMAIL_VERIFY_TTL, str(user_id))

    @staticmethod
    async def get_email_verification_user(token: str) -> uuid.UUID | None:
        """Retrieve user ID from email verification token.

        Args:
            token: Verification token

        Returns:
            User UUID if token valid, None otherwise
        """
        redis = await get_redis()
        key = f"email_verify:{token}"
        user_id_str = await redis.get(key)

        if user_id_str is None:
            return None

        return uuid.UUID(user_id_str)

    @staticmethod
    async def delete_email_verification_token(token: str) -> None:
        """Delete email verification token (after use).

        Args:
            token: Verification token
        """
        redis = await get_redis()
        key = f"email_verify:{token}"
        await redis.delete(key)

    @staticmethod
    async def store_password_reset_token(token: str, user_id: uuid.UUID) -> None:
        """Store password reset token.

        Key: password_reset:{token}
        Value: user_id (UUID as string)
        TTL: 1 hour

        Args:
            token: Reset token
            user_id: User UUID
        """
        redis = await get_redis()
        key = f"password_reset:{token}"
        await redis.setex(key, RedisService.PASSWORD_RESET_TTL, str(user_id))

    @staticmethod
    async def get_password_reset_user(token: str) -> uuid.UUID | None:
        """Retrieve user ID from password reset token.

        Args:
            token: Reset token

        Returns:
            User UUID if token valid, None otherwise
        """
        redis = await get_redis()
        key = f"password_reset:{token}"
        user_id_str = await redis.get(key)

        if user_id_str is None:
            return None

        return uuid.UUID(user_id_str)

    @staticmethod
    async def delete_password_reset_token(token: str) -> None:
        """Delete password reset token (after use).

        Args:
            token: Reset token
        """
        redis = await get_redis()
        key = f"password_reset:{token}"
        await redis.delete(key)

    @staticmethod
    async def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> bool:
        """Check if rate limit exceeded using sliding window.

        Uses Redis sorted set with timestamps as scores.

        Args:
            key: Rate limit key (e.g., "ratelimit:login:{ip}")
            max_attempts: Maximum attempts allowed
            window_seconds: Time window in seconds

        Returns:
            True if rate limit exceeded, False otherwise
        """
        redis = await get_redis()
        now = datetime.utcnow().timestamp()
        window_start = now - window_seconds

        # Remove old entries outside the window
        await redis.zremrangebyscore(key, 0, window_start)

        # Count attempts in current window
        count = await redis.zcount(key, window_start, now)

        if count >= max_attempts:
            return True

        # Add current attempt
        await redis.zadd(key, {str(now): now})

        # Set TTL on the key
        await redis.expire(key, window_seconds)

        return False

    @staticmethod
    async def is_rate_limited(key: str, max_attempts: int, window_seconds: int) -> bool:
        """Check if rate limit is exceeded without incrementing attempts.

        Args:
            key: Rate limit key
            max_attempts: Maximum attempts allowed
            window_seconds: Time window in seconds

        Returns:
            True if rate limited, False otherwise
        """
        redis = await get_redis()
        now = datetime.utcnow().timestamp()
        window_start = now - window_seconds

        await redis.zremrangebyscore(key, 0, window_start)
        count = await redis.zcount(key, window_start, now)
        return count >= max_attempts

    @staticmethod
    async def increment_rate_limit(key: str, window_seconds: int) -> None:
        """Increment rate limit attempt counter using sliding window.

        Args:
            key: Rate limit key
            window_seconds: Time window in seconds
        """
        redis = await get_redis()
        now = datetime.utcnow().timestamp()
        member = f"{now}:{datetime.utcnow().isoformat()}"

        await redis.zadd(key, {member: now})
        await redis.expire(key, window_seconds)

    @staticmethod
    async def reset_rate_limit(key: str) -> None:
        """Reset rate limit counter.

        Args:
            key: Rate limit key
        """
        redis = await get_redis()
        await redis.delete(key)
