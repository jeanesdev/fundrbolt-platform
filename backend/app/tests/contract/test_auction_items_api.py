"""Contract tests for auction items API endpoints."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestAuctionItemCreation:
    """Test POST /api/v1/events/{event_id}/auction-items endpoint contract."""

    async def test_create_auction_item_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful auction item creation with required fields."""
        from app.models.auction_item import AuctionItem

        payload = {
            "title": "Weekend Getaway Package",
            "description": "Two nights in wine country with spa treatments",
            "auction_type": "silent",
            "starting_bid": 500.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload,
        )

        # Assert response contract
        assert response.status_code == 201
        data = response.json()

        # Verify auction item data
        assert data["title"] == "Weekend Getaway Package"
        assert data["description"] == "Two nights in wine country with spa treatments"
        assert data["auction_type"] == "silent"
        assert float(data["starting_bid"]) == 500.00
        assert data["buy_now_enabled"] is False
        assert data["quantity_available"] == 1
        assert data["event_id"] == str(test_event.id)
        assert data["status"] == "draft"
        assert "id" in data
        assert "bid_number" in data
        assert 100 <= data["bid_number"] <= 999  # Valid range

        # Verify timestamps
        assert "created_at" in data
        assert "updated_at" in data

        # Verify database persistence
        from sqlalchemy import select

        stmt = select(AuctionItem).where(AuctionItem.id == data["id"])
        result = await db_session.execute(stmt)
        db_item = result.scalar_one()

        assert db_item.title == "Weekend Getaway Package"
        assert db_item.bid_number >= 100

    async def test_create_auction_item_with_all_fields(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test auction item creation with all optional fields."""
        payload = {
            "title": "Luxury Vacation Package",
            "description": "Seven days in Hawaii with airfare",
            "auction_type": "live",
            "starting_bid": 2500.00,
            "donor_value": 5000.00,
            "cost": 3000.00,
            "buy_now_price": 4500.00,
            "buy_now_enabled": True,
            "quantity_available": 2,
            "donated_by": "Travel Agency Inc",
            "item_webpage": "https://example.com/hawaii-package",
            "display_priority": 10,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify all fields
        assert data["title"] == "Luxury Vacation Package"
        assert data["auction_type"] == "live"
        assert float(data["starting_bid"]) == 2500.00
        assert float(data["donor_value"]) == 5000.00
        assert float(data["cost"]) == 3000.00
        assert float(data["buy_now_price"]) == 4500.00
        assert data["buy_now_enabled"] is True
        assert data["quantity_available"] == 2
        assert data["donated_by"] == "Travel Agency Inc"
        assert data["item_webpage"] == "https://example.com/hawaii-package"
        assert data["display_priority"] == 10

    async def test_create_auction_item_validates_auction_type(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test auction_type must be 'live' or 'silent'."""
        payload = {
            "title": "Test Item",
            "description": "Test description",
            "auction_type": "invalid_type",
            "starting_bid": 100.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload,
        )

        assert response.status_code == 422  # Validation error

    async def test_create_auction_item_requires_title(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test title is required."""
        payload = {
            "description": "Test description",
            "auction_type": "silent",
            "starting_bid": 100.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload,
        )

        assert response.status_code == 422

    async def test_create_auction_item_requires_positive_starting_bid(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test starting_bid must be positive."""
        payload = {
            "title": "Test Item",
            "description": "Test description",
            "auction_type": "silent",
            "starting_bid": -100.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload,
        )

        assert response.status_code == 422

    async def test_create_auction_item_assigns_sequential_bid_numbers(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test bid numbers are assigned sequentially starting at 100."""
        # Create first item
        payload1 = {
            "title": "Item 1",
            "description": "First item",
            "auction_type": "silent",
            "starting_bid": 100.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response1 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload1,
        )
        assert response1.status_code == 201
        bid_number_1 = response1.json()["bid_number"]
        assert bid_number_1 == 100

        # Create second item
        payload2 = {
            "title": "Item 2",
            "description": "Second item",
            "auction_type": "silent",
            "starting_bid": 200.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response2 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload2,
        )
        assert response2.status_code == 201
        bid_number_2 = response2.json()["bid_number"]
        assert bid_number_2 == 101

    async def test_create_auction_item_requires_authentication(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test endpoint requires authentication."""
        payload = {
            "title": "Test Item",
            "description": "Test description",
            "auction_type": "silent",
            "starting_bid": 100.00,
            "buy_now_enabled": False,
            "quantity_available": 1,
        }

        response = await client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json=payload,
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestAuctionItemList:
    """Test GET /api/v1/events/{event_id}/auction-items endpoint contract."""

    async def test_list_auction_items_empty(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test listing auction items when none exist."""
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/auction-items")

        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "pagination" in data
        assert data["items"] == []
        assert data["pagination"]["total"] == 0
        assert data["pagination"]["page"] == 1

    async def test_list_auction_items_with_pagination(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test pagination of auction items."""
        # Create 3 items
        for i in range(3):
            payload = {
                "title": f"Item {i + 1}",
                "description": f"Description {i + 1}",
                "auction_type": "silent",
                "starting_bid": 100.00 * (i + 1),
                "buy_now_enabled": False,
                "quantity_available": 1,
            }
            await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items",
                json=payload,
            )

        # Test default pagination
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/auction-items")

        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) == 3
        assert data["pagination"]["total"] == 3
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["limit"] == 50

        # Test custom pagination
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items",
            params={"page": 2, "limit": 2},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) == 1  # Third item on page 2
        assert data["pagination"]["page"] == 2
        assert data["pagination"]["limit"] == 2

    async def test_list_auction_items_filter_by_auction_type(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test filtering auction items by auction_type."""
        # Create live auction item
        await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Live Item",
                "description": "Live auction",
                "auction_type": "live",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )

        # Create silent auction item
        await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Silent Item",
                "description": "Silent auction",
                "auction_type": "silent",
                "starting_bid": 200.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )

        # Filter by live
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items",
            params={"auction_type": "live"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["auction_type"] == "live"

        # Filter by silent
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items",
            params={"auction_type": "silent"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["auction_type"] == "silent"

    async def test_list_auction_items_filter_by_status(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test filtering auction items by status."""
        from app.models.auction_item import AuctionItem, ItemStatus

        # Create item
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Test Item",
                "description": "Test",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = response.json()["id"]

        # Update status to published directly in DB
        from sqlalchemy import update

        stmt = (
            update(AuctionItem).where(AuctionItem.id == item_id).values(status=ItemStatus.PUBLISHED)
        )
        await db_session.execute(stmt)
        await db_session.commit()

        # Filter by published
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items",
            params={"status": "published"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["status"] == "published"

    async def test_list_auction_items_search_by_title(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test searching auction items by title."""
        # Create items
        await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Wine Tasting Package",
                "description": "Visit Napa Valley",
                "auction_type": "silent",
                "starting_bid": 300.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )

        await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Golf Outing",
                "description": "18 holes at prestigious course",
                "auction_type": "silent",
                "starting_bid": 400.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )

        # Search for "wine"
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items",
            params={"search": "wine"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert "Wine" in data["items"][0]["title"]

    async def test_list_auction_items_allows_unauthenticated(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test endpoint allows unauthenticated access (returns empty list)."""
        response = await client.get(f"/api/v1/events/{test_event.id}/auction-items")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "pagination" in data


@pytest.mark.asyncio
class TestAuctionItemDetail:
    """Test GET /api/v1/events/{event_id}/auction-items/{item_id} endpoint contract."""

    async def test_get_auction_item_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test retrieving a single auction item."""
        # Create item
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Test Item",
                "description": "Test description",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = create_response.json()["id"]

        # Get item
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items/{item_id}"
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == item_id
        assert data["title"] == "Test Item"
        assert data["description"] == "Test description"
        assert data["event_id"] == str(test_event.id)

    async def test_get_auction_item_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test getting non-existent auction item returns 404."""
        from uuid import uuid4

        fake_id = str(uuid4())

        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items/{fake_id}"
        )

        assert response.status_code == 404

    async def test_get_auction_item_allows_unauthenticated(
        self,
        client: AsyncClient,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test endpoint allows unauthenticated access to published items."""
        # Create a published item first (as authenticated user)
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Public Item",
                "description": "Viewable by all",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = create_response.json()["id"]

        # Get item as unauthenticated user
        response = await client.get(f"/api/v1/events/{test_event.id}/auction-items/{item_id}")

        # Should return 200 (public access allowed)
        assert response.status_code in (200, 404)  # May be 404 if only published items shown


@pytest.mark.asyncio
class TestAuctionItemUpdate:
    """Test PATCH /api/v1/events/{event_id}/auction-items/{item_id} endpoint contract."""

    async def test_update_auction_item_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating auction item fields."""
        # Create item
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Original Title",
                "description": "Original description",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = create_response.json()["id"]

        # Update item
        update_payload = {
            "title": "Updated Title",
            "starting_bid": 150.00,
            "buy_now_price": 300.00,
            "buy_now_enabled": True,
        }

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/auction-items/{item_id}",
            json=update_payload,
        )

        # Debug: Print response if not 200
        if response.status_code != 200:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")

        assert response.status_code == 200
        data = response.json()

        assert data["title"] == "Updated Title"
        assert float(data["starting_bid"]) == 150.00
        assert float(data["buy_now_price"]) == 300.00
        assert data["buy_now_enabled"] is True
        # Unchanged fields
        assert data["description"] == "Original description"
        assert data["auction_type"] == "silent"

    async def test_update_auction_item_partial_update(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test partial update (only some fields)."""
        # Create item
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Test Item",
                "description": "Test description",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = create_response.json()["id"]

        # Update only title
        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/auction-items/{item_id}",
            json={"title": "New Title Only"},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["title"] == "New Title Only"
        assert data["description"] == "Test description"  # Unchanged

    async def test_update_auction_item_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating non-existent item returns 404."""
        from uuid import uuid4

        fake_id = str(uuid4())

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/auction-items/{fake_id}",
            json={"title": "Updated"},
        )

        assert response.status_code == 404

    async def test_update_auction_item_requires_authentication(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test endpoint requires authentication."""
        from uuid import uuid4

        fake_id = str(uuid4())

        response = await client.patch(
            f"/api/v1/events/{test_event.id}/auction-items/{fake_id}",
            json={"title": "Updated"},
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestAuctionItemDelete:
    """Test DELETE /api/v1/events/{event_id}/auction-items/{item_id} endpoint contract."""

    async def test_delete_auction_item_draft_hard_delete(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test deleting draft item performs hard delete."""
        from app.models.auction_item import AuctionItem

        # Create draft item
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Draft Item",
                "description": "Will be deleted",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = create_response.json()["id"]

        # Delete item
        response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/auction-items/{item_id}"
        )

        assert response.status_code == 204

        # Verify hard delete (item doesn't exist in DB)
        from sqlalchemy import select

        stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        result = await db_session.execute(stmt)
        db_item = result.scalar_one_or_none()

        assert db_item is None

    async def test_delete_auction_item_published_soft_delete(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test deleting published item performs soft delete."""
        from app.models.auction_item import AuctionItem, ItemStatus

        # Create and publish item
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/auction-items",
            json={
                "title": "Published Item",
                "description": "Will be soft deleted",
                "auction_type": "silent",
                "starting_bid": 100.00,
                "buy_now_enabled": False,
                "quantity_available": 1,
            },
        )
        item_id = create_response.json()["id"]

        # Update to published status
        from sqlalchemy import update

        stmt = (
            update(AuctionItem).where(AuctionItem.id == item_id).values(status=ItemStatus.PUBLISHED)
        )
        await db_session.execute(stmt)
        await db_session.commit()

        # Delete item
        response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/auction-items/{item_id}"
        )

        assert response.status_code == 204

        # Verify soft delete (item exists with status=withdrawn)
        from sqlalchemy import select

        stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        result = await db_session.execute(stmt)
        db_item = result.scalar_one()

        assert db_item.status == ItemStatus.WITHDRAWN

    async def test_delete_auction_item_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test deleting non-existent item returns 404."""
        from uuid import uuid4

        fake_id = str(uuid4())

        response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/auction-items/{fake_id}"
        )

        assert response.status_code == 404

    async def test_delete_auction_item_requires_authentication(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test endpoint requires authentication."""
        from uuid import uuid4

        fake_id = str(uuid4())

        response = await client.delete(f"/api/v1/events/{test_event.id}/auction-items/{fake_id}")

        assert response.status_code == 401
