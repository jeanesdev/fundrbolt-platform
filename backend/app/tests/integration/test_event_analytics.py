"""Integration tests for event analytics endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventStatus

pytestmark = pytest.mark.asyncio


async def test_event_dashboard_summary_and_segments(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_approved_npo: Any,
    test_npo_admin_user: Any,
    test_npo_admin_token: str,
) -> None:
    event = Event(
        npo_id=test_approved_npo.id,
        name="Analytics Event",
        slug="analytics-event",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=7),
        timezone="America/New_York",
        venue_name="FundrBolt Hall",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    headers = {"Authorization": f"Bearer {test_npo_admin_token}"}

    summary_response = await async_client.get(
        f"/api/v1/admin/events/{event.id}/dashboard",
        headers={**headers, "X-Debug-Now": "not-a-date"},
    )
    assert summary_response.status_code == 200

    unauthorized_response = await async_client.get(
        f"/api/v1/admin/events/{event.id}/dashboard",
    )
    assert unauthorized_response.status_code == 401
