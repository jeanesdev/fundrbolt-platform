"""Contract tests for user import commit endpoint."""

import json
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npo_member import NPOMember
from app.models.user import User


@pytest.mark.asyncio
class TestUserImportCommit:
    """Test POST /api/v1/admin/users/import/commit."""

    async def test_commit_success(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        db_session: AsyncSession,
    ) -> None:
        users = [
            {
                "full_name": "Jordan Lee",
                "email": "jordan.lee@example.org",
                "role": "NPO Admin",
                "password": "TestPass123",
            }
        ]
        payload = json.dumps(users).encode("utf-8")

        preflight_response = await npo_admin_client.post(
            "/api/v1/admin/users/import/preflight",
            files={"file": ("users.json", payload, "application/json")},
        )
        preflight_data = preflight_response.json()

        response = await npo_admin_client.post(
            "/api/v1/admin/users/import/commit",
            files={"file": ("users.json", payload, "application/json")},
            data={
                "preflight_id": preflight_data["preflight_id"],
                "confirm": True,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["created_rows"] == 1
        assert data["skipped_rows"] == 0
        assert data["membership_added_rows"] == 0
        assert data["failed_rows"] == 0

        stmt = select(User).where(User.email == "jordan.lee@example.org")
        user_result = await db_session.execute(stmt)
        user = user_result.scalar_one()

        member_stmt = select(NPOMember).where(
            NPOMember.user_id == user.id,
            NPOMember.npo_id == test_approved_npo.id,
        )
        member_result = await db_session.execute(member_stmt)
        member = member_result.scalar_one_or_none()
        assert member is not None
