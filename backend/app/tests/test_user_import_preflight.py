"""Contract tests for user import preflight endpoint."""

import json
from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestUserImportPreflight:
    """Test POST /api/v1/admin/users/import/preflight."""

    async def test_preflight_valid_json(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        users = [
            {
                "full_name": "Jordan Lee",
                "email": "jordan.lee@example.org",
                "role": "NPO Admin",
                "npo_identifier": "Approved Test NPO",
                "password": "TestPass123",
            }
        ]
        payload = json.dumps(users).encode("utf-8")

        response = await npo_admin_client.post(
            "/api/v1/admin/users/import/preflight",
            files={"file": ("users.json", payload, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_rows"] == 1
        assert data["valid_rows"] == 1
        assert data["error_rows"] == 0
        assert data["warning_rows"] == 0
        assert data["detected_format"] == "json"
        assert "preflight_id" in data

    async def test_preflight_duplicate_emails(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        users = [
            {
                "full_name": "Jordan Lee",
                "email": "dup@example.org",
                "role": "NPO Admin",
                "password": "TestPass123",
            },
            {
                "full_name": "Jordan Lee",
                "email": "dup@example.org",
                "role": "NPO Admin",
                "password": "TestPass123",
            },
        ]
        payload = json.dumps(users).encode("utf-8")

        response = await npo_admin_client.post(
            "/api/v1/admin/users/import/preflight",
            files={"file": ("users.json", payload, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        assert any("Duplicate email" in issue["message"] for issue in data["issues"])

    async def test_preflight_invalid_role(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        users = [
            {
                "full_name": "Jordan Lee",
                "email": "jordan.lee@example.org",
                "role": "Super Admin",
                "password": "TestPass123",
            }
        ]
        payload = json.dumps(users).encode("utf-8")

        response = await npo_admin_client.post(
            "/api/v1/admin/users/import/preflight",
            files={"file": ("users.json", payload, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        assert any("Super Admin" in issue["message"] for issue in data["issues"])

    async def test_preflight_invalid_file_type(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
    ) -> None:
        response = await npo_admin_client.post(
            "/api/v1/admin/users/import/preflight",
            files={"file": ("users.txt", b"invalid", "text/plain")},
        )

        assert response.status_code == 400
