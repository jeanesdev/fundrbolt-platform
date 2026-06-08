"""Contract tests for the gender field on user endpoints.

Covers:
- POST /api/v1/users - gender accepted on creation
- PATCH /api/v1/users/{user_id} - gender updated via admin endpoint
- PATCH /api/v1/users/me/profile - gender updated via profile endpoint
- GET /api/v1/users/me - gender returned in response
"""

from typing import Any

import pytest
from httpx import AsyncClient


class TestUserGenderField:
    """Tests for the optional gender field across user endpoints."""

    @pytest.mark.asyncio
    async def test_create_user_with_gender(
        self, super_admin_client: AsyncClient, test_approved_npo: Any
    ) -> None:
        """Test that gender is accepted and returned when creating a user.

        Contract: POST /api/v1/users
        Expected: 201 Created with gender in response
        """
        payload = {
            "email": "gendercreate@example.com",
            "password": "SecurePass123",
            "first_name": "Gender",
            "last_name": "Test",
            "role": "staff",
            "npo_id": str(test_approved_npo.id),
            "gender": "non-binary",
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["gender"] == "non-binary"

    @pytest.mark.asyncio
    async def test_create_user_without_gender_defaults_to_null(
        self, super_admin_client: AsyncClient, test_approved_npo: Any
    ) -> None:
        """Test that omitting gender results in null in the response.

        Contract: POST /api/v1/users
        Expected: 201 Created with gender: null
        """
        payload = {
            "email": "nogender@example.com",
            "password": "SecurePass123",
            "first_name": "No",
            "last_name": "Gender",
            "role": "staff",
            "npo_id": str(test_approved_npo.id),
        }
        response = await super_admin_client.post("/api/v1/users", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["gender"] is None

    @pytest.mark.asyncio
    async def test_admin_update_user_gender(
        self, super_admin_client: AsyncClient, test_approved_npo: Any
    ) -> None:
        """Test that super admin can update a user's gender.

        Contract: PATCH /api/v1/users/{user_id}
        Expected: 200 OK with updated gender
        """
        create_payload = {
            "email": "genderupdate@example.com",
            "password": "SecurePass123",
            "first_name": "Gender",
            "last_name": "Update",
            "role": "staff",
            "npo_id": str(test_approved_npo.id),
        }
        create_response = await super_admin_client.post("/api/v1/users", json=create_payload)
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        update_payload = {"gender": "female"}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["gender"] == "female"

    @pytest.mark.asyncio
    async def test_admin_update_user_gender_max_length_validation(
        self, super_admin_client: AsyncClient, test_approved_npo: Any
    ) -> None:
        """Test that gender field enforces max length of 100 characters.

        Contract: PATCH /api/v1/users/{user_id}
        Expected: 422 Validation Error when gender exceeds 100 characters
        """
        create_payload = {
            "email": "genderlength@example.com",
            "password": "SecurePass123",
            "first_name": "Gender",
            "last_name": "Length",
            "role": "staff",
            "npo_id": str(test_approved_npo.id),
        }
        create_response = await super_admin_client.post("/api/v1/users", json=create_payload)
        assert create_response.status_code == 201
        user_id = create_response.json()["id"]

        # Exceeds 100 char limit
        payload = {"gender": "g" * 101}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 422

        # Exactly 100 chars is valid
        payload = {"gender": "g" * 100}
        response = await super_admin_client.patch(f"/api/v1/users/{user_id}", json=payload)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_profile_update_saves_and_returns_gender(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test that gender is saved and returned via the profile update endpoint.

        Contract: PATCH /api/v1/users/me/profile
        Expected: 200 OK with gender in response
        """
        # Fetch current profile to get required fields
        me_response = await authenticated_client.get("/api/v1/users/me")
        assert me_response.status_code == 200
        me_data = me_response.json()

        payload = {
            "first_name": me_data["first_name"],
            "last_name": me_data["last_name"],
            "gender": "prefer not to say",
        }
        response = await authenticated_client.patch("/api/v1/users/me/profile", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["gender"] == "prefer not to say"

    @pytest.mark.asyncio
    async def test_profile_update_gender_empty_string_clears_field(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test that setting gender to an empty string clears the field.

        The update endpoint uses "if not None" semantics for partial updates
        (omitting/null-ing a field keeps its current value). An empty string
        is the idiomatic way to explicitly clear an optional string field,
        consistent with how phone, city, and other optional fields behave.

        Contract: PATCH /api/v1/users/me/profile
        Expected: 200 OK with gender: null after sending gender: ""
        """
        me_response = await authenticated_client.get("/api/v1/users/me")
        assert me_response.status_code == 200
        me_data = me_response.json()

        # First set a gender
        await authenticated_client.patch(
            "/api/v1/users/me/profile",
            json={
                "first_name": me_data["first_name"],
                "last_name": me_data["last_name"],
                "gender": "male",
            },
        )

        # Then clear it with an empty string
        payload = {
            "first_name": me_data["first_name"],
            "last_name": me_data["last_name"],
            "gender": "",
        }
        response = await authenticated_client.patch("/api/v1/users/me/profile", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["gender"] is None

    @pytest.mark.asyncio
    async def test_get_me_includes_gender_field(self, authenticated_client: AsyncClient) -> None:
        """Test that GET /users/me returns the gender field with the correct value.

        Contract: GET /api/v1/users/me
        Expected: 200 OK, response contains 'gender' key and reflects the stored value
        """
        me_response = await authenticated_client.get("/api/v1/users/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert "gender" in me_data

        # Set gender via profile update
        await authenticated_client.patch(
            "/api/v1/users/me/profile",
            json={
                "first_name": me_data["first_name"],
                "last_name": me_data["last_name"],
                "gender": "non-binary",
            },
        )

        # Verify GET /me reflects the newly saved value
        me_response2 = await authenticated_client.get("/api/v1/users/me")
        assert me_response2.status_code == 200
        assert me_response2.json()["gender"] == "non-binary"
