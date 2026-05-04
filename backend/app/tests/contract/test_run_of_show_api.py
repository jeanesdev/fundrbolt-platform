"""Contract tests for run-of-show API endpoints."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run_of_show import RunOfShowItem


def _make_item(test_event: dict, **kwargs: object) -> RunOfShowItem:
    """Helper to create a RunOfShowItem with all required fields."""
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "event_id": test_event.id,
        "created_by": test_event.created_by,
        "is_complete": False,
        "donor_visible": True,
        "auctioneer_visible": True,
        "display_order": 0,
    }
    defaults.update(kwargs)
    return RunOfShowItem(**defaults)


@pytest.mark.asyncio
class TestGetEventRunOfShow:
    """Tests for GET /api/v1/admin/events/{event_id}/run-of-show."""

    async def test_get_empty_ros(self, npo_admin_client: AsyncClient, test_event: dict) -> None:
        response = await npo_admin_client.get(f"/api/v1/admin/events/{test_event.id}/run-of-show")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total_count"] == 0
        assert data["completed_count"] == 0

    async def test_get_ros_with_items(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = _make_item(test_event, title="Welcome speech")
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.get(f"/api/v1/admin/events/{test_event.id}/run-of-show")
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 1
        assert data["completed_count"] == 0
        assert data["items"][0]["title"] == "Welcome speech"

    async def test_unauthenticated(self, client: AsyncClient, test_event: dict) -> None:
        response = await client.get(f"/api/v1/admin/events/{test_event.id}/run-of-show")
        assert response.status_code == 401

    async def test_donor_forbidden(self, donor_client: AsyncClient, test_event: dict) -> None:
        response = await donor_client.get(f"/api/v1/admin/events/{test_event.id}/run-of-show")
        assert response.status_code == 403


@pytest.mark.asyncio
class TestCreateRunOfShowItem:
    """Tests for POST /api/v1/admin/events/{event_id}/run-of-show."""

    async def test_create_item(self, npo_admin_client: AsyncClient, test_event: dict) -> None:
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show",
            json={
                "title": "Welcome speech",
                "scheduled_time": "2025-12-01T18:00:00",
                "donor_visible": True,
                "auctioneer_visible": True,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Welcome speech"
        assert data["is_complete"] is False
        assert data["display_order"] == 0

    async def test_create_item_minimal(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show",
            json={"title": "Auction opens"},
        )
        assert response.status_code == 201
        assert response.json()["title"] == "Auction opens"

    async def test_create_item_increments_display_order(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show",
            json={"title": "First"},
        )
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show",
            json={"title": "Second"},
        )
        assert response.status_code == 201
        assert response.json()["display_order"] == 1

    async def test_unauthenticated(self, client: AsyncClient, test_event: dict) -> None:
        response = await client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show",
            json={"title": "Test"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdateRunOfShowItem:
    """Tests for PATCH /api/v1/admin/events/{event_id}/run-of-show/{item_id}."""

    async def test_update_item(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = _make_item(test_event, title="Old title")
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/{item.id}",
            json={"title": "Updated title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated title"

    async def test_update_nonexistent_item(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/{uuid.uuid4()}",
            json={"title": "Updated"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteRunOfShowItem:
    """Tests for DELETE /api/v1/admin/events/{event_id}/run-of-show/{item_id}."""

    async def test_delete_item(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = _make_item(test_event, title="To delete")
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/{item.id}"
        )
        assert response.status_code == 204

    async def test_delete_nonexistent_item(
        self, npo_admin_client: AsyncClient, test_event: dict
    ) -> None:
        response = await npo_admin_client.delete(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/{uuid.uuid4()}"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestCompleteRunOfShowItem:
    """Tests for POST /api/v1/admin/events/{event_id}/run-of-show/{item_id}/complete."""

    async def test_complete_item(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = _make_item(test_event, title="Welcome speech", is_complete=False)
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/{item.id}/complete"
        )
        assert response.status_code == 200
        assert response.json()["is_complete"] is True

    async def test_incomplete_item(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item = _make_item(test_event, title="Welcome speech", is_complete=True)
        db_session.add(item)
        await db_session.commit()

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/{item.id}/incomplete"
        )
        assert response.status_code == 200
        assert response.json()["is_complete"] is False


@pytest.mark.asyncio
class TestReorderRunOfShowItems:
    """Tests for PATCH /api/v1/admin/events/{event_id}/run-of-show/reorder."""

    async def test_reorder_items(
        self,
        npo_admin_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        item1 = _make_item(test_event, title="First", display_order=0)
        item2 = _make_item(test_event, title="Second", display_order=1)
        db_session.add_all([item1, item2])
        await db_session.commit()

        response = await npo_admin_client.patch(
            f"/api/v1/admin/events/{test_event.id}/run-of-show/reorder",
            json={"item_ids": [str(item2.id), str(item1.id)]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["title"] == "Second"
        assert data["items"][1]["title"] == "First"


@pytest.mark.asyncio
class TestDonorRunOfShow:
    """Tests for GET /api/v1/donor/events/{event_id}/run-of-show."""

    async def test_donor_can_get_donor_visible_items(
        self,
        donor_client: AsyncClient,
        test_event: dict,
        db_session: AsyncSession,
    ) -> None:
        visible = _make_item(
            test_event,
            title="Visible to donors",
            display_order=0,
            donor_visible=True,
            auctioneer_visible=False,
        )
        hidden = _make_item(
            test_event,
            title="Staff only",
            display_order=1,
            donor_visible=False,
            auctioneer_visible=True,
        )
        db_session.add_all([visible, hidden])
        await db_session.commit()

        response = await donor_client.get(f"/api/v1/donor/events/{test_event.id}/run-of-show")
        assert response.status_code == 200
        data = response.json()
        titles = [i["title"] for i in data["items"]]
        assert "Visible to donors" in titles
        assert "Staff only" not in titles

    async def test_unauthenticated_donor_endpoint(
        self, client: AsyncClient, test_event: dict
    ) -> None:
        response = await client.get(f"/api/v1/donor/events/{test_event.id}/run-of-show")
        assert response.status_code == 401
