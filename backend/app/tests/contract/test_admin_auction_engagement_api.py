"""Contract tests for admin auction engagement API endpoints."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.user import User
from app.services.item_promotion_service import ItemPromotionService
from app.services.item_view_service import ItemViewService
from app.services.watch_list_service import WatchListService


async def _create_auction_item(
    db_session: AsyncSession,
    event_id: uuid.UUID,
    created_by: uuid.UUID,
) -> AuctionItem:
    """Helper to create a test auction item."""
    item = AuctionItem(
        id=uuid.uuid4(),
        event_id=event_id,
        created_by=created_by,
        bid_number=100,
        title="Test Item",
        description="Test description",
        auction_type=AuctionType.SILENT.value,
        starting_bid=100.00,
        bid_increment=10.00,
        status=ItemStatus.PUBLISHED.value,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.mark.asyncio
class TestAdminAuctionEngagementAPI:
    """Contract tests for admin auction engagement endpoints."""

    async def test_get_engagement_authenticated_admin(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test GET /admin/auction/items/{item_id}/engagement as admin."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        # Add some engagement data
        watch_service = WatchListService(db_session)
        await watch_service.add_to_watch_list(item.id, test_event.id, test_user.id)
        
        view_service = ItemViewService(db_session)
        await view_service.record_view(
            item.id, test_event.id, test_user.id,
            datetime.now(UTC), 30
        )
        
        response = await async_client.get(
            f"/api/v1/admin/auction/items/{item.id}/engagement",
            headers=admin_headers,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "watchers" in data
        assert "views" in data
        assert "bids" in data
        assert "total_views" in data
        assert len(data["watchers"]) >= 1

    async def test_get_engagement_unauthenticated(
        self,
        async_client: AsyncClient,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test GET /admin/auction/items/{item_id}/engagement requires auth."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.get(
            f"/api/v1/admin/auction/items/{item.id}/engagement"
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_engagement_item_not_found(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
    ):
        """Test GET /admin/auction/items/{item_id}/engagement with invalid item."""
        response = await async_client.get(
            f"/api/v1/admin/auction/items/{uuid.uuid4()}/engagement",
            headers=admin_headers,
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_update_promotion_success(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test PATCH /admin/auction/items/{item_id}/promotion."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.patch(
            f"/api/v1/admin/auction/items/{item.id}/promotion",
            json={
                "badge_label": "Hot Item",
                "notice_message": "Limited time offer!"
            },
            headers=admin_headers,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["badge_label"] == "Hot Item"
        assert data["notice_message"] == "Limited time offer!"

    async def test_update_promotion_unauthenticated(
        self,
        async_client: AsyncClient,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test PATCH /admin/auction/items/{item_id}/promotion requires auth."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.patch(
            f"/api/v1/admin/auction/items/{item.id}/promotion",
            json={"badge_label": "Test", "notice_message": "Test"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_update_buy_now_success(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test PATCH /admin/auction/items/{item_id}/buy-now."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.patch(
            f"/api/v1/admin/auction/items/{item.id}/buy-now",
            json={
                "enabled": True,
                "remaining_quantity": 5,
                "override_reason": "Special promotion"
            },
            headers=admin_headers,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enabled"] is True
        assert data["remaining_quantity"] == 5

    async def test_update_buy_now_unauthenticated(
        self,
        async_client: AsyncClient,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test PATCH /admin/auction/items/{item_id}/buy-now requires auth."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.patch(
            f"/api/v1/admin/auction/items/{item.id}/buy-now",
            json={"enabled": True, "remaining_quantity": 5}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_update_buy_now_negative_quantity(
        self,
        async_client: AsyncClient,
        admin_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test PATCH /admin/auction/items/{item_id}/buy-now rejects negative quantity."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.patch(
            f"/api/v1/admin/auction/items/{item.id}/buy-now",
            json={"enabled": True, "remaining_quantity": -1},
            headers=admin_headers,
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
