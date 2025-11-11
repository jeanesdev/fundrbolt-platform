"""Contract tests for PATCH /api/v1/users/{user_id} endpoint.

Tests validate API contract compliance for user update operations.
These tests verify:
- Request/response schemas match OpenAPI spec
- Status codes are correct
- Field validations are enforced
- Authorization rules are enforced
"""

import pytest
from httpx import AsyncClient


class TestUsersUpdateContract:
    """Contract tests for user update endpoint."""

    @pytest.mark.asyncio
    async def test_update_user_with_organization_and_address(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test updating user with organization and address fields.

        Contract: PATCH /api/v1/users/{user_id}
        Expected: 200 OK with updated user data including all address fields
        """
        # First create a user to update
        create_payload = {
            "email": "updatetest@example.com",
            "password": "SecurePass123",
            "first_name": "Update",
            "last_name": "Test",
            "role": "staff",
        }
        create_response = await super_admin_client.post("/api/v1/users", json=create_payload)
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        # Update with organization and address fields
        update_payload = {
            "first_name": "Updated",
            "last_name": "User",
            "organization_name": "New Organization Inc.",
            "address_line1": "456 Oak Avenue",
            "address_line2": "Floor 2",
            "city": "Boston",
            "state": "Massachusetts",
            "postal_code": "02101",
            "country": "United States",
        }

        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()

        # Verify all fields were updated
        assert data["first_name"] == "Updated"
        assert data["last_name"] == "User"
        assert data["organization_name"] == "New Organization Inc."
        assert data["address_line1"] == "456 Oak Avenue"
        assert data["address_line2"] == "Floor 2"
        assert data["city"] == "Boston"
        assert data["state"] == "Massachusetts"
        assert data["postal_code"] == "02101"
        assert data["country"] == "United States"

    @pytest.mark.asyncio
    async def test_update_user_partial_address_fields(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test updating only some address fields leaves others unchanged.

        Contract: PATCH /api/v1/users/{user_id}
        Expected: 200 OK with partial update (only specified fields changed)
        """
        # Create user with initial address
        create_payload = {
            "email": "partial@example.com",
            "password": "SecurePass123",
            "first_name": "Partial",
            "last_name": "Test",
            "role": "staff",
            "organization_name": "Original Org",
            "city": "San Francisco",
            "state": "California",
            "country": "USA",
        }
        create_response = await super_admin_client.post("/api/v1/users", json=create_payload)
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        # Update only city and state
        update_payload = {
            "city": "Los Angeles",
            "state": "CA",
        }

        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()

        # Verify only specified fields changed
        assert data["city"] == "Los Angeles"
        assert data["state"] == "CA"
        # Verify others remain unchanged
        assert data["organization_name"] == "Original Org"
        assert data["country"] == "USA"
        assert data["address_line1"] is None
        assert data["address_line2"] is None
        assert data["postal_code"] is None

    @pytest.mark.asyncio
    async def test_update_user_clear_address_fields(self, super_admin_client: AsyncClient) -> None:
        """Test clearing address fields by setting to null/empty.

        Contract: PATCH /api/v1/users/{user_id}
        Expected: 200 OK with address fields set to null
        """
        # Create user with address
        create_payload = {
            "email": "clear@example.com",
            "password": "SecurePass123",
            "first_name": "Clear",
            "last_name": "Test",
            "role": "staff",
            "organization_name": "To Be Cleared",
            "address_line1": "123 Main St",
            "city": "Seattle",
        }
        create_response = await super_admin_client.post("/api/v1/users", json=create_payload)
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        # Clear organization name (empty string should set to None)
        update_payload = {
            "organization_name": "",
            "address_line1": "",
            "city": "",
        }

        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()

        # Verify fields are cleared (None/null)
        assert data["organization_name"] is None
        assert data["address_line1"] is None
        assert data["city"] is None

    @pytest.mark.asyncio
    async def test_update_user_address_max_length_validation(
        self, super_admin_client: AsyncClient
    ) -> None:
        """Test address field max length validation on update.

        Contract: PATCH /api/v1/users/{user_id}
        Expected: 422 Validation Error if field exceeds max length
        """
        # Create user
        create_payload = {
            "email": "validation@example.com",
            "password": "SecurePass123",
            "first_name": "Valid",
            "last_name": "Test",
            "role": "staff",
        }
        create_response = await super_admin_client.post("/api/v1/users", json=create_payload)
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        # Test organization_name exceeds 255
        payload = {"organization_name": "A" * 256}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 422

        # Test address_line1 exceeds 255
        payload = {"address_line1": "A" * 256}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 422

        # Test city exceeds 100
        payload = {"city": "A" * 101}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 422

        # Test postal_code exceeds 20
        payload = {"postal_code": "A" * 21}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 422

        # Test valid at max lengths
        payload = {
            "organization_name": "A" * 255,
            "address_line1": "B" * 255,
            "city": "C" * 100,
            "postal_code": "D" * 20,
        }
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 200
