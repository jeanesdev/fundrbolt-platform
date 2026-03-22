"""Contract tests for the public organizations listing endpoint."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo import NPO, NPOStatus


@pytest.mark.asyncio
async def test_list_public_npos_returns_only_approved_organizations(
    async_client: AsyncClient,
    db_session: AsyncSession,
    test_approved_npo: Any,
    test_npo_admin_user: Any,
) -> None:
    hidden_npo = NPO(
        name="Hidden Draft NPO",
        tagline="Should not be public",
        description="Draft org",
        mission_statement="Not visible",
        email="hidden-draft@example.com",
        status=NPOStatus.DRAFT,
        created_by_user_id=test_npo_admin_user.id,
    )
    db_session.add(hidden_npo)
    await db_session.commit()

    response = await async_client.get("/api/v1/npos/public")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1

    returned_ids = {item["id"] for item in payload["items"]}
    assert str(test_approved_npo.id) in returned_ids
    assert str(hidden_npo.id) not in returned_ids

    approved_item = next(
        item for item in payload["items"] if item["id"] == str(test_approved_npo.id)
    )
    assert approved_item["name"] == test_approved_npo.name
    assert "created_by_user_id" not in approved_item
