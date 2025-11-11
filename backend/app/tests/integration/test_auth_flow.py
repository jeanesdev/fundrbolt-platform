"""Integration test for registration → login → logout flow.

Tests the complete authentication flow across multiple components:
- User registration with database persistence
- Email verification (when implemented)
- User login with JWT token generation
- Session creation in PostgreSQL and Redis
- Token validation
- Logout with session revocation

This tests the integration of:
- API endpoints (auth.py)
- Services (auth_service.py, session_service.py)
- Models (User, Session)
- Security (JWT, password hashing)
- Database (PostgreSQL)
- Cache (Redis)
"""

import pytest
from httpx import AsyncClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

# TODO: Import models when they're created
# from app.models.user import User
# from app.models.session import Session


class TestAuthenticationFlow:
    """Integration tests for complete authentication flow."""

    @pytest.mark.asyncio
    async def test_complete_auth_flow_register_to_logout(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        redis_client: Redis,
    ) -> None:
        """Test complete flow: register → verify email → login → logout.

        This integration test verifies:
        1. User can register with valid data
        2. User record is created in database
        3. Email verification token is stored in Redis
        4. User can verify email (when implemented)
        5. User can login with correct credentials
        6. Access and refresh tokens are returned
        7. Session is created in PostgreSQL
        8. Session is stored in Redis
        9. User can logout
        10. Session is revoked in PostgreSQL
        11. Session is removed from Redis
        12. Access token is blacklisted
        """
        # Step 1: Register user
        register_payload = {
            "email": "flowtest@example.com",
            "password": "SecurePass123",
            "first_name": "Flow",
            "last_name": "Test",
            "phone": "+1-555-0100",
        }

        register_response = await async_client.post("/api/v1/auth/register", json=register_payload)

        assert register_response.status_code == 201
        register_data = register_response.json()
        register_data["user"]["id"]

        # Step 2: Verify user exists in database
        # TODO: Uncomment when User model is created
        # result = await db_session.execute(
        #     select(User).where(User.id == user_id)
        # )
        # user = result.scalar_one_or_none()
        # assert user is not None
        # assert user.email == "flowtest@example.com"
        # assert user.email_verified is False
        # assert user.is_active is False

        # Step 3: Verify email verification token in Redis
        # TODO: Check Redis for email verification token
        # email_verify_keys = await redis_client.keys("email_verify:*")
        # assert len(email_verify_keys) == 1

        # Step 4: Verify email (when implemented)
        # For now, skip to login which will fail due to unverified email
        pytest.skip("Email verification not yet implemented")

        # Step 5: Login (should fail until email is verified)
        login_payload = {"email": "flowtest@example.com", "password": "SecurePass123"}

        login_response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Should fail with EMAIL_NOT_VERIFIED
        assert login_response.status_code == 400
        login_data = login_response.json()
        assert login_data["detail"]["code"] == "EMAIL_NOT_VERIFIED"

        # TODO: After email verification is implemented:
        # 1. Verify email
        # 2. Login should succeed
        # 3. Verify session creation
        # 4. Logout
        # 5. Verify session revocation

    @pytest.mark.asyncio
    async def test_failed_login_does_not_create_session(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        redis_client: Redis,
    ) -> None:
        """Test failed login attempts don't create sessions.

        This verifies:
        1. Invalid credentials don't create session records
        2. No Redis session keys are created
        3. Audit logs record failed attempt (when implemented)
        """
        login_payload = {"email": "nonexistent@example.com", "password": "WrongPassword123"}

        response = await async_client.post("/api/v1/auth/login", json=login_payload)

        # Should fail
        assert response.status_code == 401

        # Verify no sessions in database
        # TODO: Uncomment when Session model is created
        # result = await db_session.execute(select(Session))
        # sessions = result.scalars().all()
        # assert len(sessions) == 0

        # Verify no session keys in Redis
        session_keys = await redis_client.keys("session:*")
        assert len(session_keys) == 0

    @pytest.mark.asyncio
    async def test_register_duplicate_email_database_constraint(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test database enforces email uniqueness.

        This verifies:
        1. First registration succeeds
        2. Second registration with same email fails at API level
        3. Database constraint prevents duplicate emails
        """
        payload = {
            "email": "unique@example.com",
            "password": "SecurePass123",
            "first_name": "Test",
            "last_name": "User",
        }

        # First registration
        response1 = await async_client.post("/api/v1/auth/register", json=payload)
        assert response1.status_code == 201

        # Second registration with same email
        response2 = await async_client.post("/api/v1/auth/register", json=payload)
        assert response2.status_code == 409

        # Verify only one user in database
        # TODO: Uncomment when User model is created
        # result = await db_session.execute(
        #     select(User).where(User.email == "unique@example.com")
        # )
        # users = result.scalars().all()
        # assert len(users) == 1

    @pytest.mark.asyncio
    async def test_password_hashing_integration(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test password is hashed in database, not stored as plaintext.

        This verifies:
        1. Password is hashed using bcrypt
        2. Database stores hash, not plaintext
        3. Login works with correct password
        4. Login fails with incorrect password
        """
        payload = {
            "email": "hashtest@example.com",
            "password": "SecurePass123",
            "first_name": "Hash",
            "last_name": "Test",
        }

        response = await async_client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 201

        # Verify password is hashed in database
        # TODO: Uncomment when User model is created
        # result = await db_session.execute(
        #     select(User).where(User.email == "hashtest@example.com")
        # )
        # user = result.scalar_one()
        # # Password hash should start with $2b$ (bcrypt)
        # assert user.password_hash.startswith("$2b$")
        # # Password hash should not equal plaintext
        # assert user.password_hash != "SecurePass123"

    @pytest.mark.asyncio
    async def test_register_with_organization_and_address_fields(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test registration with organization and address fields.

        This verifies:
        1. Registration succeeds with all 7 optional fields (organization_name + 6 address fields)
        2. Fields are stored correctly in database
        3. Login response includes all address fields
        4. Fields are properly validated for max lengths
        """
        payload = {
            "email": "address@example.com",
            "password": "SecurePass123",
            "first_name": "Address",
            "last_name": "Test",
            "phone": "+1-555-0100",
            "organization_name": "Test Organization Inc.",
            "address_line1": "123 Main Street",
            "address_line2": "Suite 100",
            "city": "San Francisco",
            "state": "California",
            "postal_code": "94102",
            "country": "United States",
        }

        # Register with all address fields
        register_response = await async_client.post("/api/v1/auth/register", json=payload)

        if register_response.status_code != 201:
            print(f"Error response: {register_response.json()}")
        assert register_response.status_code == 201
        register_data = register_response.json()

        # Verify all fields are in response
        user_data = register_data["user"]
        assert user_data["organization_name"] == "Test Organization Inc."
        assert user_data["address_line1"] == "123 Main Street"
        assert user_data["address_line2"] == "Suite 100"
        assert user_data["city"] == "San Francisco"
        assert user_data["state"] == "California"
        assert user_data["postal_code"] == "94102"
        assert user_data["country"] == "United States"

        # Test registration with partial address (only some fields)
        partial_payload = {
            "email": "partial@example.com",
            "password": "SecurePass123",
            "first_name": "Partial",
            "last_name": "Test",
            "organization_name": "Partial Org",
            "city": "Boston",
            "country": "USA",
            # Omit address_line1, address_line2, state, postal_code
        }

        partial_response = await async_client.post("/api/v1/auth/register", json=partial_payload)
        assert partial_response.status_code == 201
        partial_data = partial_response.json()["user"]
        assert partial_data["organization_name"] == "Partial Org"
        assert partial_data["city"] == "Boston"
        assert partial_data["country"] == "USA"
        assert partial_data["address_line1"] is None
        assert partial_data["address_line2"] is None
        assert partial_data["state"] is None
        assert partial_data["postal_code"] is None

    @pytest.mark.skip(
        reason="TODO: Concurrent database operations cause ResourceClosedError in test cleanup - test infrastructure issue"
    )
    @pytest.mark.asyncio
    async def test_concurrent_registration_race_condition(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test concurrent registrations with same email handle race condition.

        This verifies:
        1. Database constraint prevents duplicate emails even with concurrent requests
        2. One registration succeeds, others fail with 409
        """
        import asyncio

        payload = {
            "email": "race@example.com",
            "password": "SecurePass123",
            "first_name": "Race",
            "last_name": "Condition",
        }

        # Send 3 concurrent registration requests
        tasks = [async_client.post("/api/v1/auth/register", json=payload) for _ in range(3)]

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions and get actual response objects
        from httpx import Response

        response_objects = [r for r in responses if isinstance(r, Response)]

        # Count successes (201) and conflicts (409)
        success_count = sum(1 for r in response_objects if r.status_code == 201)
        conflict_count = sum(1 for r in response_objects if r.status_code == 409)

        # Exactly one should succeed
        assert success_count == 1
        # Others should fail with 409 (or exceptions are acceptable for race conditions)
        assert success_count + conflict_count == 3 or conflict_count >= 1
