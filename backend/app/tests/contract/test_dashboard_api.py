"""
Contract tests for Event Dashboard Admin endpoints.

Tests:
- GET /admin/events/{event_id}/dashboard - Get dashboard summary
- GET /admin/events/{event_id}/dashboard/segments - Get segment breakdown
- GET /admin/events/{event_id}/dashboard/projections - Get projections
- POST /admin/events/{event_id}/dashboard/projections - Update projections
- Authorization checks (Admin roles required)
- Filtering and scenario switching
"""

import uuid
from decimal import Decimal
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.user import User
from app.models.npo import NPO, NPOStatus


class TestGetDashboardSummary:
    """Test GET /admin/events/{event_id}/dashboard endpoint."""

    @pytest.mark.asyncio
    async def test_admin_can_get_dashboard_summary(
        self,
        admin_client: AsyncClient,
        db_session: AsyncSession,
        test_event: Event,
    ):
        """Test admin can retrieve dashboard summary for an event.

        Scenario:
        1. Create an event with goal
        2. Admin requests dashboard summary
        3. Verify response contains required fields

        Expected: 200 OK with dashboard summary
        """
        response = await admin_client.get(f"/admin/events/{test_event.id}/dashboard")

        assert response.status_code == 200
        data = response.json()

        # Verify required fields
        assert "event_id" in data
        assert "goal" in data
        assert "total_actual" in data
        assert "total_projected" in data
        assert "variance_amount" in data
        assert "variance_percent" in data
        assert "pacing" in data
        assert "sources" in data
        assert "waterfall" in data
        assert "cashflow" in data
        assert "funnel" in data
        assert "alerts" in data
        assert "last_refreshed_at" in data

        # Verify pacing structure
        assert "status" in data["pacing"]
        assert "pacing_percent" in data["pacing"]
        assert "trajectory" in data["pacing"]

    @pytest.mark.asyncio
    async def test_dashboard_with_scenario_filter(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test dashboard summary with scenario filter.

        Scenario:
        1. Request dashboard with optimistic scenario
        2. Verify response includes scenario-specific projections

        Expected: 200 OK with scenario projections
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard?scenario=optimistic"
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_projected" in data

    @pytest.mark.asyncio
    async def test_dashboard_with_date_range(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test dashboard summary with date range filter.

        Scenario:
        1. Request dashboard with start and end date
        2. Verify response is successful

        Expected: 200 OK
        """
        start_date = datetime.utcnow().date()
        end_date = (datetime.utcnow() + timedelta(days=30)).date()

        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard"
            f"?start_date={start_date}&end_date={end_date}"
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_dashboard_with_source_filter(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test dashboard summary with revenue source filter.

        Scenario:
        1. Request dashboard with specific revenue sources
        2. Verify response is successful

        Expected: 200 OK
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard?sources=tickets,sponsorships"
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_non_existent_event_returns_404(
        self,
        admin_client: AsyncClient,
    ):
        """Test dashboard for non-existent event returns 404.

        Scenario:
        1. Request dashboard for non-existent event ID
        2. Verify 404 error

        Expected: 404 Not Found
        """
        fake_event_id = uuid.uuid4()
        response = await admin_client.get(f"/admin/events/{fake_event_id}/dashboard")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_donor_cannot_access_dashboard(
        self,
        donor_client: AsyncClient,
        test_event: Event,
    ):
        """Test donor (non-admin) cannot access dashboard.

        Scenario:
        1. Donor attempts to access dashboard
        2. Verify 403 Forbidden error

        Expected: 403 Forbidden
        """
        response = await donor_client.get(f"/admin/events/{test_event.id}/dashboard")

        assert response.status_code == 403


class TestGetSegmentBreakdown:
    """Test GET /admin/events/{event_id}/dashboard/segments endpoint."""

    @pytest.mark.asyncio
    async def test_admin_can_get_segment_breakdown_by_table(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test admin can retrieve segment breakdown by table.

        Scenario:
        1. Request segment breakdown with segment_type=table
        2. Verify response structure

        Expected: 200 OK with segment breakdown
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard/segments?segment_type=table"
        )

        assert response.status_code == 200
        data = response.json()

        assert "segment_type" in data
        assert data["segment_type"] == "table"
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_segment_breakdown_all_types(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test segment breakdown for all segment types.

        Scenario:
        1. Request breakdown for each segment type
        2. Verify all return success

        Expected: 200 OK for all types
        """
        segment_types = ["table", "guest", "registrant", "company"]

        for segment_type in segment_types:
            response = await admin_client.get(
                f"/admin/events/{test_event.id}/dashboard/segments?segment_type={segment_type}"
            )

            assert response.status_code == 200
            data = response.json()
            assert data["segment_type"] == segment_type

    @pytest.mark.asyncio
    async def test_segment_breakdown_with_limit(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test segment breakdown respects limit parameter.

        Scenario:
        1. Request segment breakdown with limit=10
        2. Verify response is successful

        Expected: 200 OK
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard/segments?segment_type=table&limit=10"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 10

    @pytest.mark.asyncio
    async def test_segment_breakdown_with_sort(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test segment breakdown with sort parameter.

        Scenario:
        1. Request segment breakdown sorted by contribution_share
        2. Verify response is successful

        Expected: 200 OK
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard/segments"
            f"?segment_type=table&sort=contribution_share"
        )

        assert response.status_code == 200


class TestGetProjectionAdjustments:
    """Test GET /admin/events/{event_id}/dashboard/projections endpoint."""

    @pytest.mark.asyncio
    async def test_admin_can_get_projections(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test admin can retrieve projection adjustments.

        Scenario:
        1. Request projection adjustments
        2. Verify response structure

        Expected: 200 OK with projections
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard/projections"
        )

        assert response.status_code == 200
        data = response.json()

        assert "event_id" in data
        assert "scenario" in data
        assert "adjustments" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_projections_with_scenario(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test projection adjustments for specific scenario.

        Scenario:
        1. Request projections for optimistic scenario
        2. Verify scenario is returned

        Expected: 200 OK with optimistic scenario
        """
        response = await admin_client.get(
            f"/admin/events/{test_event.id}/dashboard/projections?scenario=optimistic"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["scenario"] == "optimistic"


class TestUpdateProjectionAdjustments:
    """Test POST /admin/events/{event_id}/dashboard/projections endpoint."""

    @pytest.mark.asyncio
    async def test_admin_can_update_projections(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test admin can update projection adjustments.

        Scenario:
        1. Submit projection adjustments
        2. Verify response contains updated values

        Expected: 200 OK with updated projections
        """
        projection_update = {
            "scenario": "optimistic",
            "adjustments": [
                {
                    "source": "tickets",
                    "projected": {"amount": "25000.00", "currency": "USD"},
                },
                {
                    "source": "sponsorships",
                    "projected": {"amount": "50000.00", "currency": "USD"},
                },
            ],
        }

        response = await admin_client.post(
            f"/admin/events/{test_event.id}/dashboard/projections",
            json=projection_update,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["scenario"] == "optimistic"
        assert len(data["adjustments"]) == 2
        assert data["updated_by"] is not None

    @pytest.mark.asyncio
    async def test_update_projections_invalid_scenario(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test updating projections with invalid scenario fails.

        Scenario:
        1. Submit projection with invalid scenario type
        2. Verify validation error

        Expected: 422 Unprocessable Entity
        """
        projection_update = {
            "scenario": "invalid_scenario",
            "adjustments": [],
        }

        response = await admin_client.post(
            f"/admin/events/{test_event.id}/dashboard/projections",
            json=projection_update,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_projections_invalid_source(
        self,
        admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test updating projections with invalid source fails.

        Scenario:
        1. Submit projection with invalid revenue source
        2. Verify validation error

        Expected: 422 Unprocessable Entity
        """
        projection_update = {
            "scenario": "base",
            "adjustments": [
                {
                    "source": "invalid_source",
                    "projected": {"amount": "25000.00", "currency": "USD"},
                },
            ],
        }

        response = await admin_client.post(
            f"/admin/events/{test_event.id}/dashboard/projections",
            json=projection_update,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_donor_cannot_update_projections(
        self,
        donor_client: AsyncClient,
        test_event: Event,
    ):
        """Test donor cannot update projections.

        Scenario:
        1. Donor attempts to update projections
        2. Verify 403 Forbidden error

        Expected: 403 Forbidden
        """
        projection_update = {
            "scenario": "base",
            "adjustments": [],
        }

        response = await donor_client.post(
            f"/admin/events/{test_event.id}/dashboard/projections",
            json=projection_update,
        )

        assert response.status_code == 403
