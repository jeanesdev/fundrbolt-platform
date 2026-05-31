"""Integration tests for guest and registration check-in flows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_checkin_and_duplicate_rejection(
    async_client: AsyncClient,
    test_registration: object,
) -> None:
    next_assignment_response = await async_client.get(
        f"/api/v1/checkin/events/{test_registration.event_id}/next-assignment"
    )
    assert next_assignment_response.status_code == 200

    checkin_response = await async_client.post(
        f"/api/v1/checkin/registrations/{test_registration.id}",
        json={"bidder_number": 123, "table_number": 4},
    )
    assert checkin_response.status_code == 200
    assert checkin_response.json()["registration"]["check_in_time"] is not None

    duplicate_response = await async_client.post(
        f"/api/v1/checkin/registrations/{test_registration.id}",
        json={"bidder_number": 123, "table_number": 4},
    )
    assert duplicate_response.status_code == 200
    assert duplicate_response.json()["registration"]["check_in_time"] is not None
