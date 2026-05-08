"""Contract tests for admin reports API endpoints (feature 045)."""

import unittest.mock
import uuid

import pytest
from fastapi import status
from httpx import AsyncClient

from app.models.event import Event
from app.models.user import User

_PDF_STUB = b"%PDF-stub"


@pytest.mark.asyncio
class TestEventSummaryReportAPI:
    """Contract tests for GET /admin/events/{event_id}/reports/event-summary."""

    async def test_requires_auth(
        self,
        async_client: AsyncClient,
    ) -> None:
        event_id = uuid.uuid4()
        response = await async_client.get(f"/api/v1/admin/events/{event_id}/reports/event-summary")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_requires_npo_admin_or_higher(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
        test_event: Event,
    ) -> None:
        response = await async_client.get(
            f"/api/v1/admin/events/{test_event.id}/reports/event-summary",
            headers=user_auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_returns_pdf_for_authorized_user(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
    ) -> None:
        with unittest.mock.patch("app.api.v1.admin_reports.EventReportService") as mock_cls:
            mock_instance = mock_cls.return_value
            mock_instance.generate_pdf = unittest.mock.AsyncMock(return_value=_PDF_STUB)

            response = await async_client.get(
                f"/api/v1/admin/events/{test_event.id}/reports/event-summary",
                headers=admin_auth_headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/pdf"
        assert b"attachment" in response.headers.get("content-disposition", "").encode()


@pytest.mark.asyncio
class TestBidCardsReportAPI:
    """Contract tests for POST /admin/events/{event_id}/reports/bid-cards."""

    async def test_requires_auth(
        self,
        async_client: AsyncClient,
    ) -> None:
        event_id = uuid.uuid4()
        response = await async_client.post(
            f"/api/v1/admin/events/{event_id}/reports/bid-cards",
            json={"label_size": "3x5"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_requires_npo_staff_or_higher(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
        test_event: Event,
    ) -> None:
        response = await async_client.post(
            f"/api/v1/admin/events/{test_event.id}/reports/bid-cards",
            json={"label_size": "3x5"},
            headers=user_auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_returns_pdf_for_authorized_user(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
    ) -> None:
        with unittest.mock.patch("app.api.v1.admin_reports.BidCardService") as mock_cls:
            mock_instance = mock_cls.return_value
            mock_instance.generate_pdf = unittest.mock.AsyncMock(return_value=_PDF_STUB)

            response = await async_client.post(
                f"/api/v1/admin/events/{test_event.id}/reports/bid-cards",
                json={"label_size": "3x5"},
                headers=admin_auth_headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/pdf"

    async def test_returns_422_when_no_items(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
    ) -> None:
        with unittest.mock.patch("app.api.v1.admin_reports.BidCardService") as mock_cls:
            mock_instance = mock_cls.return_value
            mock_instance.generate_pdf = unittest.mock.AsyncMock(side_effect=ValueError("no_items"))

            response = await async_client.post(
                f"/api/v1/admin/events/{test_event.id}/reports/bid-cards",
                json={"label_size": "3x5"},
                headers=admin_auth_headers,
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        detail = response.json()["detail"]
        # detail may be a string or dict with a message field
        detail_text = detail if isinstance(detail, str) else str(detail)
        assert "no published auction items" in detail_text.lower()

    async def test_accepts_specific_item_ids(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
    ) -> None:
        item_id = str(uuid.uuid4())
        with unittest.mock.patch("app.api.v1.admin_reports.BidCardService") as mock_cls:
            mock_instance = mock_cls.return_value
            mock_instance.generate_pdf = unittest.mock.AsyncMock(return_value=_PDF_STUB)

            response = await async_client.post(
                f"/api/v1/admin/events/{test_event.id}/reports/bid-cards",
                json={"label_size": "2x4", "item_ids": [item_id]},
                headers=admin_auth_headers,
            )

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.asyncio
class TestAuctioneerReportAPI:
    """Contract tests for GET /admin/events/{event_id}/auctioneer/report."""

    async def test_requires_auth(
        self,
        async_client: AsyncClient,
    ) -> None:
        event_id = uuid.uuid4()
        response = await async_client.get(f"/api/v1/admin/events/{event_id}/auctioneer/report")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_requires_auctioneer_or_super_admin(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
        test_event: Event,
    ) -> None:
        response = await async_client.get(
            f"/api/v1/admin/events/{test_event.id}/auctioneer/report",
            headers=user_auth_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_returns_pdf_for_authorized_user(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_event: Event,
        test_user: User,
    ) -> None:
        with unittest.mock.patch("app.api.v1.admin_reports.AuctioneerReportService") as mock_cls:
            mock_instance = mock_cls.return_value
            mock_instance.generate_pdf = unittest.mock.AsyncMock(return_value=_PDF_STUB)
            with unittest.mock.patch(
                "app.api.v1.admin_reports._verify_event_access",
                return_value=None,
            ):
                with unittest.mock.patch(
                    "app.api.v1.admin_reports._resolve_auctioneer_id",
                    return_value=test_user.id,
                ):
                    response = await async_client.get(
                        f"/api/v1/admin/events/{test_event.id}/auctioneer/report",
                        headers=admin_auth_headers,
                    )

        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/pdf"
