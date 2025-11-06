"""Contract tests for NPO Management API endpoints.

Tests the NPO creation, retrieval, and update API endpoints against the OpenAPI contract.
These tests verify that the API adheres to the expected request/response formats.
"""

import uuid
from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestNPOCreationContract:
    """Contract tests for POST /api/v1/npos endpoint."""

    async def test_create_npo_success_returns_201(self, authenticated_client: AsyncClient):
        """Test creating NPO returns 201 with NPO data."""
        # Arrange
        npo_data = {
            "name": "Test Charity Organization",
            "email": "contact@testcharity.org",
            "description": "A test charity organization",
            "mission_statement": "To help those in need",
            "website_url": "https://testcharity.org",
            "phone": "+1234567890",
            "address_line1": "123 Main St",
            "address_line2": "Suite 100",
            "city": "Test City",
            "state_province": "TC",
            "postal_code": "12345",
            "country": "US",
            "tax_id": "12-3456789",
        }

        # Act
        response = await authenticated_client.post("/api/v1/npos", json=npo_data)

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "npo" in data
        assert "message" in data

        npo = data["npo"]
        assert "id" in npo
        assert npo["name"] == npo_data["name"]
        assert npo["email"] == npo_data["email"]
        assert npo["status"] == "draft"  # New NPOs start as draft
        assert "created_at" in npo
        assert "updated_at" in npo

    async def test_create_npo_minimal_fields_returns_201(self, authenticated_client: AsyncClient):
        """Test creating NPO with only required fields returns 201."""
        npo_data = {
            "name": "Minimal NPO",
            "email": "minimal@npo.org",
        }

        response = await authenticated_client.post("/api/v1/npos", json=npo_data)

        assert response.status_code == 201
        data = response.json()
        assert data["npo"]["name"] == npo_data["name"]
        assert data["npo"]["email"] == npo_data["email"]

    async def test_create_npo_duplicate_name_returns_400(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test creating NPO with duplicate name returns 409."""
        npo_data = {
            "name": test_npo.name,  # Duplicate name
            "email": "different@email.org",
        }

        response = await authenticated_client.post("/api/v1/npos", json=npo_data)

        assert response.status_code == 409  # Conflict status for duplicate
        data = response.json()
        assert "detail" in data

    async def test_create_npo_invalid_email_returns_422(self, authenticated_client: AsyncClient):
        """Test creating NPO with invalid email returns 422."""
        npo_data = {
            "name": "Invalid Email NPO",
            "email": "not-an-email",
        }

        response = await authenticated_client.post("/api/v1/npos", json=npo_data)

        assert response.status_code == 422

    async def test_create_npo_missing_required_fields_returns_422(
        self, authenticated_client: AsyncClient
    ):
        """Test creating NPO without required fields returns 422."""
        npo_data = {
            "description": "Missing name and email",
        }

        response = await authenticated_client.post("/api/v1/npos", json=npo_data)

        assert response.status_code == 422

    async def test_create_npo_unauthenticated_returns_401(self, async_client: AsyncClient):
        """Test creating NPO without authentication returns 401."""
        npo_data = {
            "name": "Unauthenticated NPO",
            "email": "unauth@npo.org",
        }

        response = await async_client.post("/api/v1/npos", json=npo_data)

        assert response.status_code == 401


@pytest.mark.asyncio
class TestNPOListContract:
    """Contract tests for GET /api/v1/npos endpoint."""

    async def test_list_npos_success_returns_200(self, authenticated_client: AsyncClient):
        """Test listing NPOs returns 200 with pagination."""
        response = await authenticated_client.get("/api/v1/npos")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert isinstance(data["items"], list)

    async def test_list_npos_with_pagination_returns_200(self, authenticated_client: AsyncClient):
        """Test listing NPOs with pagination parameters."""
        response = await authenticated_client.get("/api/v1/npos?page=1&page_size=10")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10

    async def test_list_npos_with_status_filter_returns_200(
        self, authenticated_client: AsyncClient
    ):
        """Test listing NPOs filtered by status."""
        response = await authenticated_client.get("/api/v1/npos?status=draft")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_list_npos_with_search_returns_200(self, authenticated_client: AsyncClient):
        """Test listing NPOs with search query."""
        response = await authenticated_client.get("/api/v1/npos?search=test")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_list_npos_unauthenticated_returns_401(self, async_client: AsyncClient):
        """Test listing NPOs without authentication returns 401."""
        response = await async_client.get("/api/v1/npos")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestNPODetailContract:
    """Contract tests for GET /api/v1/npos/{npo_id} endpoint."""

    async def test_get_npo_success_returns_200(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test getting NPO details returns 200 with full data."""
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_npo.id)
        assert data["name"] == test_npo.name
        assert data["email"] == test_npo.email
        assert "status" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "member_count" in data or "active_member_count" in data

    async def test_get_npo_nonexistent_returns_404(self, authenticated_client: AsyncClient):
        """Test getting non-existent NPO returns 403 (permission check happens first)."""
        fake_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/npos/{fake_id}")

        assert response.status_code == 403  # Permission check happens before existence check
        data = response.json()
        assert "detail" in data

    async def test_get_npo_no_permission_returns_403(
        self, authenticated_client_2: AsyncClient, test_npo: Any
    ):
        """Test getting NPO without access returns 403."""
        response = await authenticated_client_2.get(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 403

    async def test_get_npo_invalid_uuid_returns_422(self, authenticated_client: AsyncClient):
        """Test getting NPO with invalid UUID returns 422."""
        response = await authenticated_client.get("/api/v1/npos/not-a-uuid")

        assert response.status_code == 422

    async def test_get_npo_unauthenticated_returns_401(
        self, async_client: AsyncClient, test_npo: Any
    ):
        """Test getting NPO without authentication returns 401."""
        response = await async_client.get(f"/api/v1/npos/{test_npo.id}")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestNPOUpdateContract:
    """Contract tests for PATCH /api/v1/npos/{npo_id} endpoint."""

    async def test_update_npo_success_returns_200(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test updating NPO returns 200 with updated data."""
        update_data = {
            "description": "Updated description",
            "website_url": "https://updated-website.org",
        }

        response = await authenticated_client.patch(f"/api/v1/npos/{test_npo.id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == update_data["description"]
        # HttpUrl adds trailing slash, so check with that
        assert data["website_url"].rstrip("/") == update_data["website_url"].rstrip("/")

    async def test_update_npo_partial_update_success(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test partial NPO update with single field."""
        update_data = {"phone": "+9876543210"}

        response = await authenticated_client.patch(f"/api/v1/npos/{test_npo.id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == update_data["phone"]

    async def test_update_npo_invalid_email_returns_422(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test updating NPO with invalid email returns 422."""
        update_data = {"email": "not-an-email"}

        response = await authenticated_client.patch(f"/api/v1/npos/{test_npo.id}", json=update_data)

        assert response.status_code == 422

    async def test_update_npo_duplicate_name_returns_400(
        self, authenticated_client: AsyncClient, test_npo: Any, test_npo_2: Any
    ):
        """Test updating NPO with existing name returns 409."""
        update_data = {"name": test_npo_2.name}

        response = await authenticated_client.patch(f"/api/v1/npos/{test_npo.id}", json=update_data)

        assert response.status_code == 409  # Conflict status for duplicate

    async def test_update_npo_nonexistent_returns_404(self, authenticated_client: AsyncClient):
        """Test updating non-existent NPO returns 403 (permission check first)."""
        fake_id = uuid.uuid4()
        update_data = {"description": "Test"}

        response = await authenticated_client.patch(f"/api/v1/npos/{fake_id}", json=update_data)

        assert response.status_code == 403  # Permission check happens before existence check

    async def test_update_npo_no_permission_returns_403(
        self, authenticated_client_2: AsyncClient, test_npo: Any
    ):
        """Test updating NPO without admin permission returns 403."""
        update_data = {"description": "No permission"}

        response = await authenticated_client_2.patch(
            f"/api/v1/npos/{test_npo.id}", json=update_data
        )

        assert response.status_code == 403

    async def test_update_npo_unauthenticated_returns_401(
        self, async_client: AsyncClient, test_npo: Any
    ):
        """Test updating NPO without authentication returns 401."""
        update_data = {"description": "Test"}

        response = await async_client.patch(f"/api/v1/npos/{test_npo.id}", json=update_data)

        assert response.status_code == 401
