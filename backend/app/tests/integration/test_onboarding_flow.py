"""Integration tests for the NPO onboarding wizard API.

Tests:
- POST /api/v1/public/onboarding/sessions — create session
- GET /api/v1/public/onboarding/sessions/{token} — get session state
- PATCH /api/v1/public/onboarding/sessions/{token}/steps/{step} — update step
- POST /api/v1/public/onboarding/submit — submit NPO onboarding (skipped w/o DB)

US2: Authenticated users skip account/verify steps.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestCreateSession:
    """Tests for POST /api/v1/public/onboarding/sessions."""

    @pytest.mark.asyncio
    async def test_create_npo_onboarding_session(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Creating an onboarding session returns a token and starts at 'account'."""
        response = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "token" in data
        assert data["session_type"] == "npo_onboarding"
        assert data["current_step"] == "account"
        assert data["completed_steps"] == []
        assert data["user_id"] is None

    @pytest.mark.asyncio
    async def test_create_user_signup_session(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """User-signup session type is accepted and stored."""
        response = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "user_signup"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["session_type"] == "user_signup"

    @pytest.mark.asyncio
    async def test_create_session_invalid_type_rejected(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Invalid session_type returns 422."""
        response = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "invalid_type"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_authenticated_user_session_starts_at_npo_profile(
        self,
        async_client: AsyncClient,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """US2: Authenticated users skip account/verify steps — session starts at npo_profile."""
        response = await authenticated_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["current_step"] == "npo_profile"
        assert data["user_id"] is not None


class TestGetSession:
    """Tests for GET /api/v1/public/onboarding/sessions/{token}."""

    @pytest.mark.asyncio
    async def test_get_existing_session(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Can retrieve a session by its token."""
        # Create session first
        create_resp = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        assert create_resp.status_code == 201
        token = create_resp.json()["token"]

        # Retrieve it
        get_resp = await async_client.get(f"/api/v1/public/onboarding/sessions/{token}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["token"] == token
        assert data["session_type"] == "npo_onboarding"

    @pytest.mark.asyncio
    async def test_get_nonexistent_session_returns_404(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Unknown token returns 404."""
        response = await async_client.get("/api/v1/public/onboarding/sessions/nonexistent-token")
        assert response.status_code == 404


class TestUpdateStep:
    """Tests for PATCH /api/v1/public/onboarding/sessions/{token}/steps/{step}."""

    @pytest.mark.asyncio
    async def test_update_account_step_advances_to_verify_email(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Saving 'account' step advances current_step to 'verify_email'."""
        # Create session
        create_resp = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        token = create_resp.json()["token"]

        # Update account step
        patch_resp = await async_client.patch(
            f"/api/v1/public/onboarding/sessions/{token}/steps/account",
            json={"data": {"email": "wizard@test.org", "first_name": "Tester"}},
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data["current_step"] == "verify_email"
        assert "account" in data["completed_steps"]
        assert data["form_data"]["account"]["email"] == "wizard@test.org"

    @pytest.mark.asyncio
    async def test_update_step_replaces_data(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Each update_step call replaces the step's stored data entirely."""
        create_resp = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        token = create_resp.json()["token"]

        # First save
        await async_client.patch(
            f"/api/v1/public/onboarding/sessions/{token}/steps/account",
            json={"data": {"email": "first@test.org"}},
        )
        # Second save — replaces the step payload entirely
        patch_resp = await async_client.patch(
            f"/api/v1/public/onboarding/sessions/{token}/steps/account",
            json={"data": {"first_name": "Alice"}},
        )
        assert patch_resp.status_code == 200
        form_data = patch_resp.json()["form_data"]["account"]
        # Second payload is stored; first payload is gone
        assert form_data.get("first_name") == "Alice"
        assert form_data.get("email") is None

    @pytest.mark.asyncio
    async def test_update_invalid_step_returns_422(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Unknown step names are rejected."""
        create_resp = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        token = create_resp.json()["token"]

        patch_resp = await async_client.patch(
            f"/api/v1/public/onboarding/sessions/{token}/steps/hacker_step",
            json={"data": {}},
        )
        assert patch_resp.status_code == 422

    @pytest.mark.asyncio
    async def test_npo_profile_step_advances_to_first_event(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Saving 'npo_profile' after 'account' advances to 'first_event'."""
        create_resp = await async_client.post(
            "/api/v1/public/onboarding/sessions",
            json={"session_type": "npo_onboarding"},
        )
        token = create_resp.json()["token"]

        # Complete account step
        await async_client.patch(
            f"/api/v1/public/onboarding/sessions/{token}/steps/account",
            json={"data": {"email": "npo@test.org"}},
        )
        # Complete npo_profile step
        patch_resp = await async_client.patch(
            f"/api/v1/public/onboarding/sessions/{token}/steps/npo_profile",
            json={"data": {"npo_name": "Test NPO", "ein": "12-3456789"}},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["current_step"] == "first_event"
        assert "npo_profile" in patch_resp.json()["completed_steps"]
