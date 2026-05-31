"""Integration tests for admin import flows."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_user_import_preflight_commit_and_error_report(
    async_client: AsyncClient,
    test_super_admin_token: str,
    test_approved_npo: Any,
) -> None:
    headers = {"Authorization": f"Bearer {test_super_admin_token}"}
    file_bytes = (
        b'[{"email":"imported-user@example.com","full_name":"Imported User","role":"donor"}]'
    )
    query = f"/api/v1/admin/users/import/preflight?npo_id={test_approved_npo.id}"

    preflight_response = await async_client.post(
        query,
        files={"file": ("users.json", file_bytes, "application/json")},
        headers=headers,
    )
    assert preflight_response.status_code == 200, preflight_response.json()
    preflight = preflight_response.json()
    assert preflight["total_rows"] == 1

    commit_response = await async_client.post(
        f"/api/v1/admin/users/import/commit?npo_id={test_approved_npo.id}",
        data={"preflight_id": preflight["preflight_id"], "confirm": "true"},
        files={"file": ("users.json", file_bytes, "application/json")},
        headers=headers,
    )
    assert commit_response.status_code == 200, commit_response.json()
    assert commit_response.json()["created_rows"] == 1

    error_report_response = await async_client.post(
        "/api/v1/admin/users/import/error-report",
        json={
            "format": "csv",
            "rows": [
                {
                    "row_number": 2,
                    "email": "duplicate@example.com",
                    "full_name": "Duplicate User",
                    "status": "error",
                    "message": "duplicate",
                }
            ],
        },
        headers=headers,
    )
    assert error_report_response.status_code == 200
    assert "duplicate" in error_report_response.json()["content"]
