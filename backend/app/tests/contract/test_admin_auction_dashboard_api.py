"""Contract tests for admin auction dashboard API endpoints."""

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
    *,
    title: str = "Test Auction Item",
    auction_type: str = AuctionType.SILENT.value,
    status: str = ItemStatus.PUBLISHED.value,
) -> AuctionItem:
    """Helper to create a test auction item."""
    item = AuctionItem(
        id=uuid.uuid4(),
        event_id=event_id,
        created_by=created_by,
        bid_number=100,
        title=title,
        description="Test description",
        auction_type=auction_type,
        starting_bid=100.00,
        bid_increment=10.00,
        buy_now_price=500.00,
        status=status,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.mark.asyncio
class TestAuctionDashboardSummaryAPI:
    """Contract tests for GET /admin/auction-dashboard/summary."""

    async def test_summary_requires_auth(self, async_client: AsyncClient) -> None:
        response = await async_client.get("/api/v1/admin/auction-dashboard/summary")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_summary_authenticated_admin(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        await _create_auction_item(db_session, test_event.id, test_user.id)

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/summary",
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_items" in data
        assert "total_bids" in data
        assert "total_revenue" in data
        assert "average_bid_amount" in data
        assert data["total_items"] >= 1

    async def test_summary_scoped_to_event(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        await _create_auction_item(db_session, test_event.id, test_user.id)
        other_event_id = uuid.uuid4()

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/summary",
            params={"event_id": str(other_event_id)},
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_items"] == 0


@pytest.mark.asyncio
class TestAuctionDashboardItemsAPI:
    """Contract tests for GET /admin/auction-dashboard/items."""

    async def test_items_requires_auth(self, async_client: AsyncClient) -> None:
        response = await async_client.get("/api/v1/admin/auction-dashboard/items")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_items_returns_paginated_list(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        await _create_auction_item(db_session, test_event.id, test_user.id, title="Alpha Item")
        await _create_auction_item(db_session, test_event.id, test_user.id, title="Beta Item")

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/items",
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "total_pages" in data
        assert data["total"] >= 2

    async def test_items_search(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        await _create_auction_item(db_session, test_event.id, test_user.id, title="Unique XYZ Item")
        await _create_auction_item(db_session, test_event.id, test_user.id, title="Other Item")

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/items",
            params={"search": "Unique XYZ"},
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Unique XYZ Item"

    async def test_items_sorting(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        await _create_auction_item(db_session, test_event.id, test_user.id, title="AAAA Item")
        await _create_auction_item(db_session, test_event.id, test_user.id, title="ZZZZ Item")

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/items",
            params={"sort_by": "title", "sort_order": "asc"},
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        titles = [i["title"] for i in data["items"]]
        assert titles == sorted(titles)

    async def test_items_pagination(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        for i in range(5):
            await _create_auction_item(db_session, test_event.id, test_user.id, title=f"Item {i}")

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/items",
            params={"page": 1, "per_page": 2},
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) <= 2
        assert data["per_page"] == 2

    async def test_items_item_structure(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        await _create_auction_item(db_session, test_event.id, test_user.id)

        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/items",
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        items = response.json()["items"]
        assert len(items) >= 1
        item = items[0]
        assert "id" in item
        assert "title" in item
        assert "auction_type" in item
        assert "status" in item
        assert "event_id" in item
        assert "event_name" in item


@pytest.mark.asyncio
class TestAuctionDashboardChartsAPI:
    """Contract tests for GET /admin/auction-dashboard/charts."""

    async def test_charts_requires_auth(self, async_client: AsyncClient) -> None:
        response = await async_client.get("/api/v1/admin/auction-dashboard/charts")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_charts_returns_expected_structure(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
    ) -> None:
        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/charts",
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "revenue_by_type" in data
        assert "revenue_by_category" in data
        assert "bid_count_by_type" in data
        assert "top_items_by_revenue" in data
        assert "top_items_by_bid_count" in data


@pytest.mark.asyncio
class TestAuctionDashboardItemDetailAPI:
    """Contract tests for GET /admin/auction-dashboard/items/{item_id}."""

    async def test_item_detail_requires_auth(self, async_client: AsyncClient) -> None:
        response = await async_client.get(f"/api/v1/admin/auction-dashboard/items/{uuid.uuid4()}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_item_detail_not_found(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
    ) -> None:
        response = await async_client.get(
            f"/api/v1/admin/auction-dashboard/items/{uuid.uuid4()}",
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_item_detail_returns_item(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        response = await async_client.get(
            f"/api/v1/admin/auction-dashboard/items/{item.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "item" in data
        assert "bid_history" in data
        assert "bid_timeline" in data
        assert data["item"]["id"] == str(item.id)
        assert data["item"]["title"] == item.title

    async def test_item_detail_access_denied_for_other_npo(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Item from accessible NPO should be visible; unknown NPO filter returns 404."""
        item = await _create_auction_item(db_session, test_event.id, test_user.id)

        # Pass an unknown npo_id — item won't be in scope
        response = await async_client.get(
            f"/api/v1/admin/auction-dashboard/items/{item.id}",
            params={"npo_id": str(uuid.uuid4())},
            headers=admin_auth_headers,
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
class TestAuctionDashboardExportAPI:
    """Contract tests for GET /admin/auction-dashboard/items/export."""

    async def test_export_requires_auth(self, async_client: AsyncClient) -> None:
        response = await async_client.get("/api/v1/admin/auction-dashboard/items/export")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_export_returns_csv(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
    ) -> None:
        response = await async_client.get(
            "/api/v1/admin/auction-dashboard/items/export",
            headers=admin_auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response.headers.get("content-type", "")
