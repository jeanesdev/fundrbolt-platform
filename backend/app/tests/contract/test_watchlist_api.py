"""Contract tests for watchlist API endpoints."""

import uuid

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.event import Event
from app.models.user import User


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
        watcher_count=0,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.mark.asyncio
class TestWatchlistAPI:
    """Contract tests for watchlist API endpoints."""

    async def test_get_watchlist_authenticated(
        self,
        async_client: AsyncClient,
        authenticated_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test GET /watchlist returns user's watch list."""
        # Create and add item to watch list
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        # Add to watch list
        response = await async_client.post(
            "/api/v1/watchlist",
            json={"item_id": str(item.id)},
            headers=authenticated_headers,
        )
        assert response.status_code == status.HTTP_201_CREATED
        
        # Get watch list
        response = await async_client.get(
            "/api/v1/watchlist",
            headers=authenticated_headers,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1

    async def test_get_watchlist_unauthenticated(
        self,
        async_client: AsyncClient,
    ):
        """Test GET /watchlist requires authentication."""
        response = await async_client.get("/api/v1/watchlist")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_add_to_watchlist_success(
        self,
        async_client: AsyncClient,
        authenticated_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test POST /watchlist adds item successfully."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.post(
            "/api/v1/watchlist",
            json={"item_id": str(item.id)},
            headers=authenticated_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["item_id"] == str(item.id)
        assert data["user_id"] == str(test_user.id)

    async def test_add_to_watchlist_unauthenticated(
        self,
        async_client: AsyncClient,
    ):
        """Test POST /watchlist requires authentication."""
        response = await async_client.post(
            "/api/v1/watchlist",
            json={"item_id": str(uuid.uuid4())},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_add_to_watchlist_invalid_item(
        self,
        async_client: AsyncClient,
        authenticated_headers: dict,
    ):
        """Test POST /watchlist with non-existent item."""
        response = await async_client.post(
            "/api/v1/watchlist",
            json={"item_id": str(uuid.uuid4())},
            headers=authenticated_headers,
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_remove_from_watchlist_success(
        self,
        async_client: AsyncClient,
        authenticated_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test DELETE /watchlist/{item_id} removes item."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        # Add to watch list first
        await async_client.post(
            "/api/v1/watchlist",
            json={"item_id": str(item.id)},
            headers=authenticated_headers,
        )
        
        # Remove from watch list
        response = await async_client.delete(
            f"/api/v1/watchlist/{item.id}",
            headers=authenticated_headers,
        )
        
        assert response.status_code == status.HTTP_204_NO_CONTENT

    async def test_remove_from_watchlist_not_watching(
        self,
        async_client: AsyncClient,
        authenticated_headers: dict,
        test_user: User,
        test_event: Event,
        db_session: AsyncSession,
    ):
        """Test DELETE /watchlist/{item_id} for item not in watch list."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)
        
        response = await async_client.delete(
            f"/api/v1/watchlist/{item.id}",
            headers=authenticated_headers,
        )
        
        # Should still return 204 even if not watching
        assert response.status_code == status.HTTP_204_NO_CONTENT

    async def test_remove_from_watchlist_unauthenticated(
        self,
        async_client: AsyncClient,
    ):
        """Test DELETE /watchlist/{item_id} requires authentication."""
        response = await async_client.delete(
            f"/api/v1/watchlist/{uuid.uuid4()}"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
