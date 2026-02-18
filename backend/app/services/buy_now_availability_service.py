"""Service for buy-now availability operations."""

import logging
import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem
from app.models.buy_now_availability import BuyNowAvailability

logger = logging.getLogger(__name__)


class BuyNowAvailabilityService:
    """Service for managing buy-now availability."""

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session
        """
        self.db = db

    async def update_availability(
        self,
        item_id: UUID,
        event_id: UUID,
        updated_by_user_id: UUID,
        enabled: bool,
        remaining_quantity: int,
        override_reason: str | None = None,
    ) -> BuyNowAvailability:
        """Update or create buy-now availability.

        Args:
            item_id: Auction item ID
            event_id: Event ID
            updated_by_user_id: User making the update
            enabled: Whether buy-now is enabled
            remaining_quantity: Remaining quantity available
            override_reason: Optional reason for the override

        Returns:
            Updated or created buy-now availability

        Raises:
            ValueError: If item not found or validation fails
        """
        # Verify item exists
        item_stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise ValueError(f"Auction item {item_id} not found")

        # Validation
        if remaining_quantity < 0:
            raise ValueError("Remaining quantity cannot be negative")

        # Check if availability record exists
        stmt = select(BuyNowAvailability).where(BuyNowAvailability.item_id == item_id)
        result = await self.db.execute(stmt)
        availability = result.scalar_one_or_none()

        if availability:
            # Update existing
            availability.enabled = enabled
            availability.remaining_quantity = remaining_quantity
            availability.override_reason = override_reason
            availability.updated_by_user_id = updated_by_user_id
        else:
            # Create new
            availability = BuyNowAvailability(
                id=uuid.uuid4(),
                item_id=item_id,
                event_id=event_id,
                updated_by_user_id=updated_by_user_id,
                enabled=enabled,
                remaining_quantity=remaining_quantity,
                override_reason=override_reason,
            )
            self.db.add(availability)

        # Update item's buy_now_enabled and quantity_available
        item.buy_now_enabled = enabled
        if enabled:
            item.quantity_available = remaining_quantity

        await self.db.commit()
        await self.db.refresh(availability)

        logger.info(
            f"Updated buy-now availability for item {item_id}: enabled={enabled}, quantity={remaining_quantity}"
        )
        return availability

    async def get_availability(self, item_id: UUID) -> BuyNowAvailability | None:
        """Get buy-now availability for an item.

        Args:
            item_id: Auction item ID

        Returns:
            Buy-now availability or None if not found
        """
        stmt = select(BuyNowAvailability).where(BuyNowAvailability.item_id == item_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def decrement_quantity(self, item_id: UUID, quantity: int = 1) -> bool:
        """Decrement remaining quantity after a buy-now purchase.

        Args:
            item_id: Auction item ID
            quantity: Quantity to decrement

        Returns:
            True if successful, False if insufficient quantity

        Raises:
            ValueError: If availability record not found
        """
        stmt = select(BuyNowAvailability).where(BuyNowAvailability.item_id == item_id)
        result = await self.db.execute(stmt)
        availability = result.scalar_one_or_none()

        if not availability:
            raise ValueError(f"Buy-now availability record not found for item {item_id}")

        if availability.remaining_quantity < quantity:
            logger.warning(
                f"Insufficient quantity for item {item_id}: requested={quantity}, available={availability.remaining_quantity}"
            )
            return False

        availability.remaining_quantity -= quantity

        # Also update the item's quantity_available
        item_stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if item:
            item.quantity_available = availability.remaining_quantity
            # Disable buy-now if quantity reaches zero
            if availability.remaining_quantity == 0:
                availability.enabled = False
                item.buy_now_enabled = False

        await self.db.commit()

        logger.info(
            f"Decremented buy-now quantity for item {item_id} by {quantity}, remaining={availability.remaining_quantity}"
        )
        return True
