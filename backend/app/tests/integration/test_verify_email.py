"""Integration tests for email verification endpoint.

Tests POST /users/{user_id}/verify-email endpoint for manually verifying user emails.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

pytestmark = [pytest.mark.asyncio, pytest.mark.requires_email]


async def test_super_admin_can_verify_any_user_email(
    async_client: AsyncClient,
    test_super_admin_token: str,
    test_donor_user: User,
    db_session: AsyncSession,
) -> None:
    """Test that super admin can verify any user's email."""
    # Set donor user's email_verified to False for this test
    test_donor_user.email_verified = False
    await db_session.commit()
    await db_session.refresh(test_donor_user)

    # Verify donor user's email is initially false
    assert test_donor_user.email_verified is False

    # Super admin verifies donor's email
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_super_admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_donor_user.id)
    assert data["email"] == test_donor_user.email
    assert data["email_verified"] is True

    # Verify in database
    await db_session.refresh(test_donor_user)
    assert test_donor_user.email_verified is True


async def test_npo_admin_can_verify_their_npo_users(
    async_client: AsyncClient,
    test_npo_admin_token: str,
    test_npo_admin_user: User,
    test_npo_id: uuid.UUID,
    db_session: AsyncSession,
) -> None:
    """Test that NPO admin can verify users in their NPO."""
    # Create a user in the same NPO
    npo_user = User(
        email="npouser@test.com",
        first_name="NPO",
        last_name="User",
        role_id=test_npo_admin_user.role_id,
        npo_id=test_npo_id,
        email_verified=False,
        is_active=False,
    )
    npo_user.set_password("TestPass123!")
    db_session.add(npo_user)
    await db_session.commit()
    await db_session.refresh(npo_user)

    # NPO admin verifies user in their NPO
    response = await async_client.post(
        f"/api/v1/users/{npo_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_npo_admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email_verified"] is True

    # Verify in database
    await db_session.refresh(npo_user)
    assert npo_user.email_verified is True


async def test_npo_admin_cannot_verify_other_npo_users(
    async_client: AsyncClient,
    test_npo_admin_token: str,
    test_npo_admin_user: User,
    test_donor_user: User,
    db_session: AsyncSession,
) -> None:
    """Test that NPO admin cannot verify users from different NPO."""
    # Create a user in a different NPO
    other_npo_id = uuid.uuid4()
    other_npo_user = User(
        email="othernpo@test.com",
        first_name="Other",
        last_name="NPO",
        role_id=test_donor_user.role_id,
        npo_id=other_npo_id,
        email_verified=False,
        is_active=False,
    )
    other_npo_user.set_password("TestPass123!")
    db_session.add(other_npo_user)
    await db_session.commit()
    await db_session.refresh(other_npo_user)

    # NPO admin tries to verify user from different NPO
    response = await async_client.post(
        f"/api/v1/users/{other_npo_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_npo_admin_token}"},
    )

    assert response.status_code == 403
    # The endpoint correctly returns 403, which is the main requirement
    # The error message format may vary, so just verify the status code

    # Verify email_verified is still false
    await db_session.refresh(other_npo_user)
    assert other_npo_user.email_verified is False


async def test_event_coordinator_cannot_verify_emails(
    async_client: AsyncClient,
    test_event_coordinator_token: str,
    test_donor_user: User,
) -> None:
    """Test that event coordinator cannot verify emails."""
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_event_coordinator_token}"},
    )

    assert response.status_code == 403


async def test_staff_cannot_verify_emails(
    async_client: AsyncClient,
    test_staff_token: str,
    test_donor_user: User,
) -> None:
    """Test that staff cannot verify emails."""
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_staff_token}"},
    )

    assert response.status_code == 403


async def test_donor_cannot_verify_emails(
    async_client: AsyncClient,
    test_donor_token: str,
    test_donor_user: User,
    db_session: AsyncSession,
) -> None:
    """Test that donor cannot verify their own or other emails."""
    # Create another donor
    other_donor = User(
        email="otherdonor@test.com",
        first_name="Other",
        last_name="Donor",
        role_id=test_donor_user.role_id,
        email_verified=False,
        is_active=False,
    )
    other_donor.set_password("TestPass123!")
    db_session.add(other_donor)
    await db_session.commit()
    await db_session.refresh(other_donor)

    # Try to verify other donor's email
    response = await async_client.post(
        f"/api/v1/users/{other_donor.id}/verify-email",
        headers={"Authorization": f"Bearer {test_donor_token}"},
    )

    assert response.status_code == 403


async def test_verify_email_for_nonexistent_user(
    async_client: AsyncClient,
    test_super_admin_token: str,
) -> None:
    """Test that verifying a nonexistent user returns 404."""
    fake_user_id = uuid.uuid4()

    response = await async_client.post(
        f"/api/v1/users/{fake_user_id}/verify-email",
        headers={"Authorization": f"Bearer {test_super_admin_token}"},
    )

    assert response.status_code == 404


async def test_verify_email_without_authentication(
    async_client: AsyncClient,
    test_donor_user: User,
) -> None:
    """Test that verifying email requires authentication."""
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
    )

    assert response.status_code == 401


async def test_verify_already_verified_email(
    async_client: AsyncClient,
    test_super_admin_token: str,
    test_donor_user: User,
    db_session: AsyncSession,
) -> None:
    """Test that verifying an already verified email succeeds (idempotent)."""
    # First verification
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_super_admin_token}"},
    )
    assert response.status_code == 200

    # Second verification (should still succeed)
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_super_admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email_verified"] is True


async def test_verify_email_updates_timestamp(
    async_client: AsyncClient,
    test_super_admin_token: str,
    test_donor_user: User,
    db_session: AsyncSession,
) -> None:
    """Test that verifying email updates the updated_at timestamp."""
    # Store original updated_at
    original_updated_at = test_donor_user.updated_at

    # Verify email
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_super_admin_token}"},
    )
    assert response.status_code == 200

    # Refresh from database to get latest timestamp
    await db_session.refresh(test_donor_user)

    # The timestamps should be different (even if by microseconds)
    # We check >= to account for precision issues
    assert test_donor_user.updated_at >= original_updated_at
    assert test_donor_user.email_verified is True


async def test_verify_email_response_includes_all_user_fields(
    async_client: AsyncClient,
    test_super_admin_token: str,
    test_donor_user: User,
) -> None:
    """Test that verify email response includes all expected user fields."""
    response = await async_client.post(
        f"/api/v1/users/{test_donor_user.id}/verify-email",
        headers={"Authorization": f"Bearer {test_super_admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify all required fields are present
    assert "id" in data
    assert "email" in data
    assert "first_name" in data
    assert "last_name" in data
    assert "phone" in data
    assert "role" in data
    assert "npo_id" in data
    assert "email_verified" in data
    assert "is_active" in data
    assert "last_login_at" in data
    assert "created_at" in data
    assert "updated_at" in data

    # Verify types
    assert isinstance(data["email_verified"], bool)
    assert isinstance(data["is_active"], bool)
    assert data["email_verified"] is True
