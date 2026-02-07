"""Service for item promotion operations."""

import logging
import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem
from app.models.item_promotion import ItemPromotion

logger = logging.getLogger(__name__)


class ItemPromotionService:
    """Service for managing auction item promotions."""

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session
        """
        self.db = db

    async def update_promotion(
        self,
        item_id: UUID,
        event_id: UUID,
        updated_by_user_id: UUID,
        badge_label: str | None,
        notice_message: str | None,
    ) -> ItemPromotion:
        """Update or create item promotion.

        Args:
            item_id: Auction item ID
            event_id: Event ID
            updated_by_user_id: User making the update
            badge_label: Promotional badge label
            notice_message: Promotional notice message

        Returns:
            Updated or created item promotion

        Raises:
            ValueError: If item not found
        """
        # Verify item exists
        item_stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise ValueError(f"Auction item {item_id} not found")

        # Check if promotion exists
        stmt = select(ItemPromotion).where(ItemPromotion.item_id == item_id)
        result = await self.db.execute(stmt)
        promotion = result.scalar_one_or_none()

        if promotion:
            # Update existing
            promotion.badge_label = badge_label
            promotion.notice_message = notice_message
            promotion.updated_by_user_id = updated_by_user_id
        else:
            # Create new
            promotion = ItemPromotion(
                id=uuid.uuid4(),
                item_id=item_id,
                event_id=event_id,
                updated_by_user_id=updated_by_user_id,
                badge_label=badge_label,
                notice_message=notice_message,
            )
            self.db.add(promotion)

        # Also update the denormalized fields on the item
        item.promotion_badge = badge_label
        item.promotion_notice = notice_message

        await self.db.commit()
        await self.db.refresh(promotion)

        logger.info(f"Updated promotion for item {item_id}")
        return promotion

    async def get_promotion(self, item_id: UUID) -> ItemPromotion | None:
        """Get item promotion.

        Args:
            item_id: Auction item ID

        Returns:
            Item promotion or None if not found
        """
        stmt = select(ItemPromotion).where(ItemPromotion.item_id == item_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_promotion(self, item_id: UUID) -> bool:
        """Delete item promotion.

        Args:
            item_id: Auction item ID

        Returns:
            True if deleted, False if not found
        """
        stmt = select(ItemPromotion).where(ItemPromotion.item_id == item_id)
        result = await self.db.execute(stmt)
        promotion = result.scalar_one_or_none()

        if not promotion:
            return False

        # Clear denormalized fields on item
        item_stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if item:
            item.promotion_badge = None
            item.promotion_notice = None

        await self.db.delete(promotion)
        await self.db.commit()

        logger.info(f"Deleted promotion for item {item_id}")
        return True
