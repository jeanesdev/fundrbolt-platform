"""Service for caching ticket management data in Redis."""

import json
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


class TicketCacheService:
    """Service for caching ticket sales data in Redis.

    Business Rules:
    - Sales count cached with 5-second TTL (SC-004: 3-second polling + 2s buffer)
    - Promo code validation cached with 60-second TTL
    - Cache-aside pattern: check cache first, fetch from DB on miss, update cache
    """

    SALES_COUNT_TTL = timedelta(seconds=5)
    PROMO_VALIDATION_TTL = timedelta(seconds=60)

    def __init__(self, redis_client: Redis | None = None):
        """Initialize TicketCacheService with optional Redis client override (for testing)."""
        self.redis = redis_client  # Will be injected by dependency

    # ===== Sales Count Caching =====

    async def get_sales_count(self, package_id: uuid.UUID) -> int | None:
        """Get cached sales count for a ticket package.

        Args:
            package_id: Ticket package UUID

        Returns:
            Cached sold count or None if not in cache
        """
        try:
            key = self._sales_count_key(package_id)
            value = await self.redis.get(key)
            if value:
                return int(value)
            return None
        except Exception as e:
            logger.error(f"Failed to get sales count from cache for package {package_id}: {e}")
            return None

    async def set_sales_count(self, package_id: uuid.UUID, sold_count: int) -> None:
        """Cache sales count for a ticket package.

        Args:
            package_id: Ticket package UUID
            sold_count: Current sold count
        """
        try:
            key = self._sales_count_key(package_id)
            await self.redis.setex(
                key,
                self.SALES_COUNT_TTL,
                str(sold_count),
            )
        except Exception as e:
            logger.error(f"Failed to set sales count in cache for package {package_id}: {e}")

    async def increment_sales_count(self, package_id: uuid.UUID, quantity: int = 1) -> int | None:
        """Increment cached sales count (used after successful purchase).

        Args:
            package_id: Ticket package UUID
            quantity: Number of packages purchased

        Returns:
            New sold count or None if cache update failed
        """
        try:
            key = self._sales_count_key(package_id)
            new_count = await self.redis.incrby(key, quantity)
            # Refresh TTL
            await self.redis.expire(key, self.SALES_COUNT_TTL)
            return new_count
        except Exception as e:
            logger.error(f"Failed to increment sales count in cache for package {package_id}: {e}")
            return None

    async def invalidate_sales_count(self, package_id: uuid.UUID) -> None:
        """Invalidate cached sales count (used after updates/refunds).

        Args:
            package_id: Ticket package UUID
        """
        try:
            key = self._sales_count_key(package_id)
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Failed to invalidate sales count cache for package {package_id}: {e}")

    # ===== Promo Code Validation Caching =====

    async def get_promo_validation(
        self, promo_code: str, event_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """Get cached promo code validation result.

        Args:
            promo_code: Promo code string
            event_id: Event UUID

        Returns:
            Cached validation result dict or None if not in cache
            Format: {"valid": bool, "discount_amount": Decimal, "error_message": str}
        """
        try:
            key = self._promo_validation_key(promo_code, event_id)
            value = await self.redis.get(key)
            if value:
                data = json.loads(value)
                # Convert discount_amount back to Decimal
                if data.get("discount_amount"):
                    data["discount_amount"] = Decimal(data["discount_amount"])
                return data
            return None
        except Exception as e:
            logger.error(f"Failed to get promo validation from cache for {promo_code}: {e}")
            return None

    async def set_promo_validation(
        self,
        promo_code: str,
        event_id: uuid.UUID,
        validation_result: dict[str, Any],
    ) -> None:
        """Cache promo code validation result.

        Args:
            promo_code: Promo code string
            event_id: Event UUID
            validation_result: Validation result dict
        """
        try:
            key = self._promo_validation_key(promo_code, event_id)
            # Convert Decimal to string for JSON serialization
            data = validation_result.copy()
            if data.get("discount_amount"):
                data["discount_amount"] = str(data["discount_amount"])

            await self.redis.setex(
                key,
                self.PROMO_VALIDATION_TTL,
                json.dumps(data),
            )
        except Exception as e:
            logger.error(f"Failed to set promo validation in cache for {promo_code}: {e}")

    async def invalidate_promo_validation(self, promo_code: str, event_id: uuid.UUID) -> None:
        """Invalidate cached promo code validation (used after updates).

        Args:
            promo_code: Promo code string
            event_id: Event UUID
        """
        try:
            key = self._promo_validation_key(promo_code, event_id)
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Failed to invalidate promo validation cache for {promo_code}: {e}")

    # ===== Cache Key Generators =====

    @staticmethod
    def _sales_count_key(package_id: uuid.UUID) -> str:
        """Generate Redis key for sales count cache."""
        return f"ticket:sales_count:{package_id}"

    @staticmethod
    def _promo_validation_key(promo_code: str, event_id: uuid.UUID) -> str:
        """Generate Redis key for promo validation cache."""
        return f"ticket:promo_validation:{event_id}:{promo_code.upper()}"
