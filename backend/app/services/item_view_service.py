"""Service for item view tracking."""

import logging
import uuid
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_view import ItemView

logger = logging.getLogger(__name__)


class ItemViewService:
    """Service for tracking auction item views."""

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: SQLAlchemy async session
        """
        self.db = db

    async def record_view(
        self,
        item_id: UUID,
        event_id: UUID,
        user_id: UUID,
        view_started_at: datetime,
        view_duration_seconds: int,
    ) -> ItemView:
        """Record an item view.

        Args:
            item_id: Auction item ID
            event_id: Event ID
            user_id: User ID
            view_started_at: When the view started
            view_duration_seconds: How long the user viewed the item

        Returns:
            Created item view record
        """
        view = ItemView(
            id=uuid.uuid4(),
            item_id=item_id,
            event_id=event_id,
            user_id=user_id,
            view_started_at=view_started_at,
            view_duration_seconds=view_duration_seconds,
        )
        self.db.add(view)
        await self.db.commit()
        await self.db.refresh(view)

        logger.info(f"Recorded view for item {item_id} by user {user_id}: {view_duration_seconds}s")
        return view

    async def get_item_views(self, item_id: UUID) -> list[ItemView]:
        """Get all views for an item (admin use).

        Args:
            item_id: Auction item ID

        Returns:
            List of item views
        """
        stmt = (
            select(ItemView)
            .where(ItemView.item_id == item_id)
            .order_by(ItemView.view_started_at.desc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_view_stats(self, item_id: UUID) -> dict[str, int]:
        """Get view statistics for an item.

        Args:
            item_id: Auction item ID

        Returns:
            Dictionary with total_views, total_duration, unique_viewers
        """
        # Total views and duration
        views_stmt = select(
            func.count(ItemView.id).label("total_views"),
            func.sum(ItemView.view_duration_seconds).label("total_duration"),
        ).where(ItemView.item_id == item_id)

        views_result = await self.db.execute(views_stmt)
        views_row = views_result.first()

        # Unique viewers
        unique_stmt = select(func.count(func.distinct(ItemView.user_id))).where(
            ItemView.item_id == item_id
        )
        unique_result = await self.db.execute(unique_stmt)
        unique_viewers = unique_result.scalar()

        return {
            "total_views": views_row.total_views if views_row else 0,
            "total_duration_seconds": int(views_row.total_duration or 0) if views_row else 0,
            "unique_viewers": unique_viewers or 0,
        }

    async def get_user_views(
        self,
        user_id: UUID,
        event_id: UUID | None = None,
    ) -> list[ItemView]:
        """Get all views by a user.

        Args:
            user_id: User ID
            event_id: Optional event ID to filter by

        Returns:
            List of item views
        """
        stmt = select(ItemView).where(ItemView.user_id == user_id)

        if event_id:
            stmt = stmt.where(ItemView.event_id == event_id)

        stmt = stmt.order_by(ItemView.view_started_at.desc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())
