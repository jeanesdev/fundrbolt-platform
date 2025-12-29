"""Pytest configuration and fixtures."""

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
import pytest_asyncio
from httpx import AsyncClient
from redis.asyncio import Redis  # type: ignore[import-untyped]
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.user import User

settings = get_settings()

# ================================
# Event Loop Configuration
# ================================


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """
    Create event loop for async tests.

    Scope: session - one event loop for all tests
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ================================
# Database Fixtures
# ================================


@pytest.fixture(scope="session")
def test_database_url() -> str:
    """
    Get test database URL.

    Uses separate test database to avoid conflicts with development data.
    Ensures asyncpg driver is used for async SQLAlchemy.
    """
    # Get database URL from settings
    db_url: str = str(settings.database_url)

    # If already using test database, keep it (for CI)
    if "test" in db_url:
        pass
    # Otherwise, replace database name with test database
    elif "/fundrbolt_db" in db_url:
        db_url = db_url.replace("/fundrbolt_db", "/fundrbolt_test_db")
    elif db_url.endswith("/fundrbolt"):
        db_url = db_url.replace("/fundrbolt", "/fundrbolt_test")

    # Ensure we're using postgresql+asyncpg:// not postgresql://
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    return db_url


@pytest_asyncio.fixture(scope="session")
async def test_engine(test_database_url: str) -> AsyncGenerator[AsyncEngine, None]:
    """
    Create test database engine.

    Scope: session - one engine for all tests
    Uses NullPool to avoid connection pooling in tests
    """
    engine = create_async_engine(test_database_url, poolclass=NullPool, echo=False)

    # Create all tables including roles
    async with engine.begin() as conn:
        # First create roles table (required by users table FK)
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS roles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(50) UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    scope VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT role_name_valid CHECK (
                        name IN ('super_admin', 'npo_admin', 'event_coordinator',
                                 'staff', 'donor')
                    ),
                    CONSTRAINT role_scope_valid CHECK (
                        scope IN ('platform', 'npo', 'event', 'own')
                    )
                )
            """
            )
        )

        # Seed roles
        await conn.execute(
            text(
                """
                INSERT INTO roles (name, description, scope) VALUES
                    ('super_admin',
                     'Fundrbolt platform staff with full access to all NPOs and events',
                     'platform'),
                    ('npo_admin',
                     'Full management access within assigned nonprofit organization(s)',
                     'npo'),
                    ('event_coordinator',
                     'Event and auction management within assigned NPO',
                     'npo'),
                    ('staff', 'Donor registration and check-in within assigned events', 'event'),
                    ('donor', 'Bidding and profile management only', 'own')
                ON CONFLICT (name) DO NOTHING
            """
            )
        )

        # Reflect the roles table into Base.metadata so auth_service can use it
        await conn.run_sync(lambda sync_conn: Base.metadata.reflect(bind=sync_conn, only=["roles"]))

    # Create PostgreSQL enum types for legal documentation (matching migration 007)
    # Each enum creation needs its own transaction block since CREATE TYPE errors
    # leave the transaction in a failed state
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE TYPE legal_document_type AS ENUM ('terms_of_service', 'privacy_policy')"
                )
            )
    except Exception:
        pass  # Type already exists

    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("CREATE TYPE legal_document_status AS ENUM ('draft', 'published', 'archived')")
            )
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("CREATE TYPE consent_status AS ENUM ('active', 'withdrawn', 'superseded')")
            )
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE TYPE consent_action AS ENUM ('consent_given', 'consent_updated', 'consent_withdrawn', 'data_export_requested', 'data_deletion_requested', 'cookie_consent_updated')"
                )
            )
    except Exception:
        pass

    # Create all other tables in a fresh transaction
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Skip cleanup to avoid test hangs
    # The test database is ephemeral and will be cleaned up when
    # the CI container exits. Attempting to drop tables and dispose
    # the engine can hang indefinitely if connections are still open.
    # Since we use NullPool, there should be no pooled connections anyway.


@pytest_asyncio.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create database session for each test.

    Scope: function - new session for each test
    Uses transaction rollback to keep tests isolated
    """
    # Start a transaction
    connection = await test_engine.connect()
    transaction = await connection.begin()

    # Create session bound to transaction
    session = AsyncSession(bind=connection, expire_on_commit=False)

    yield session

    # Rollback transaction and close connection
    await session.close()
    await transaction.rollback()
    await connection.close()


# ================================
# Redis Fixtures
# ================================


@pytest_asyncio.fixture
async def redis_client() -> AsyncGenerator["Redis[Any]", None]:
    """
    Create Redis client for tests.

    Scope: function - new client for each test
    Uses database 1 for tests (default is 0)
    """
    client: Redis[Any] = Redis.from_url(
        str(settings.redis_url),
        encoding="utf-8",
        decode_responses=True,
        db=1,  # Use separate database for tests
    )

    yield client

    # Clear test database
    await client.flushdb()
    await client.close()  # type: ignore[attr-defined]


# ================================
# FastAPI Client Fixtures
# ================================


@pytest_asyncio.fixture
async def client(async_client: AsyncClient) -> AsyncClient:
    """
    Create non-authenticated async test client.

    Scope: function - new client for each test
    Use for testing unauthorized access (401 responses)
    """
    # Remove any auth headers if present
    if "Authorization" in async_client.headers:
        del async_client.headers["Authorization"]
    return async_client


@pytest_asyncio.fixture
async def async_client(
    db_session: AsyncSession, redis_client: Redis
) -> AsyncGenerator[AsyncClient, None]:  # type: ignore[type-arg]
    """
    Create async test client.

    Scope: function - new client for each test
    Use for tests that need async operations
    """

    from app.core.redis import get_redis

    # Override get_db dependency to use test session
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    # Override get_redis dependency to use test Redis client (db=1)
    async def override_get_redis() -> Redis:  # type: ignore[type-arg]
        return redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client

    app.dependency_overrides.clear()


# ================================
# Authentication Fixtures
# ================================


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> Any:
    """
    Create a test user for authentication tests.

    Returns a User model instance with verified email and active status.
    Password: TestPass123
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get donor role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
    donor_role_id = role_result.scalar_one()

    # Create test user
    user = User(
        email="test@example.com",
        first_name="Test",
        last_name="User",
        phone="+1-555-0100",
        password_hash=hash_password("TestPass123"),
        email_verified=True,
        is_active=True,
        role_id=donor_role_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Add role_name attribute (normally attached by auth middleware)
    user.role_name = "donor"  # type: ignore[attr-defined]

    return user


@pytest_asyncio.fixture
async def test_super_admin_user(db_session: AsyncSession) -> Any:
    """
    Create a test super_admin user.

    Returns a User model instance with super_admin role.
    Password: TestPass123
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get super_admin role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'super_admin'"))
    super_admin_role_id = role_result.scalar_one()

    # Create test super_admin user
    user = User(
        email="superadmin@test.com",
        first_name="Super",
        last_name="Admin",
        phone="+1-555-0001",
        password_hash=hash_password("TestPass123"),
        email_verified=True,
        is_active=True,
        role_id=super_admin_role_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_npo_admin_user(db_session: AsyncSession) -> Any:
    """
    Create a test npo_admin user.

    Returns a User model instance with npo_admin role and npo_id.
    Password: TestPass123
    """
    import uuid

    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get npo_admin role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'npo_admin'"))
    npo_admin_role_id = role_result.scalar_one()

    # Create test NPO ID
    npo_id = uuid.uuid4()

    # Create test npo_admin user
    user = User(
        email="npoadmin@test.com",
        first_name="NPO",
        last_name="Admin",
        phone="+1-555-0002",
        password_hash=hash_password("TestPass123"),
        email_verified=True,
        is_active=True,
        role_id=npo_admin_role_id,
        npo_id=npo_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_npo_id(test_npo_admin_user: Any) -> Any:
    """
    Get the NPO ID from the test NPO admin user.
    """
    return test_npo_admin_user.npo_id


@pytest_asyncio.fixture
async def test_event_coordinator_user(db_session: AsyncSession, test_npo_id: Any) -> Any:
    """
    Create a test event_coordinator user.

    Returns a User model instance with event_coordinator role and npo_id.
    Password: TestPass123
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get event_coordinator role_id from database
    role_result = await db_session.execute(
        text("SELECT id FROM roles WHERE name = 'event_coordinator'")
    )
    event_coordinator_role_id = role_result.scalar_one()

    # Create test event_coordinator user
    user = User(
        email="eventcoordinator@test.com",
        first_name="Event",
        last_name="Coordinator",
        phone="+1-555-0003",
        password_hash=hash_password("TestPass123"),
        email_verified=True,
        is_active=True,
        role_id=event_coordinator_role_id,
        npo_id=test_npo_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_staff_user(db_session: AsyncSession, test_npo_id: Any) -> Any:
    """
    Create a test staff user.

    Returns a User model instance with staff role and npo_id.
    Password: TestPass123
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get staff role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'staff'"))
    staff_role_id = role_result.scalar_one()

    # Create test staff user
    user = User(
        email="staff@test.com",
        first_name="Staff",
        last_name="Member",
        phone="+1-555-0004",
        password_hash=hash_password("TestPass123"),
        email_verified=True,
        is_active=True,
        role_id=staff_role_id,
        npo_id=test_npo_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_donor_user(db_session: AsyncSession) -> Any:
    """
    Create a test donor user.

    Returns a User model instance with donor role.
    Password: TestPass123
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get donor role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
    donor_role_id = role_result.scalar_one()

    # Create test donor user
    user = User(
        email="donor@test.com",
        first_name="Donor",
        last_name="Person",
        phone="+1-555-0005",
        password_hash=hash_password("TestPass123"),
        email_verified=True,  # Set to True for authentication tests
        is_active=True,
        role_id=donor_role_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_super_admin_token(async_client: AsyncClient, test_super_admin_user: Any) -> str:
    """Get access token for test super_admin user."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_super_admin_user.email,
            "password": "TestPass123",
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def test_npo_admin_token(async_client: AsyncClient, test_npo_admin_user: Any) -> str:
    """Get access token for test npo_admin user."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_npo_admin_user.email,
            "password": "TestPass123",
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def test_event_coordinator_token(
    async_client: AsyncClient, test_event_coordinator_user: Any
) -> str:
    """Get access token for test event_coordinator user."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_event_coordinator_user.email,
            "password": "TestPass123",
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def test_staff_token(async_client: AsyncClient, test_staff_user: Any) -> str:
    """Get access token for test staff user."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_staff_user.email,
            "password": "TestPass123",
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def test_donor_token(async_client: AsyncClient, test_donor_user: Any) -> str:
    """Get access token for test donor user."""
    # First set donor as verified and active to allow login
    test_donor_user.email_verified = True
    test_donor_user.is_active = True

    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_donor_user.email,
            "password": "TestPass123",
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def authenticated_client(async_client: AsyncClient, test_user: Any) -> AsyncClient:
    """
    Create authenticated async test client with access token.

    Returns AsyncClient with Authorization header set to valid access token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest_asyncio.fixture
async def super_admin_client(async_client: AsyncClient, test_super_admin_user: Any) -> AsyncClient:
    """
    Create authenticated async test client with super_admin access token.

    Returns AsyncClient with Authorization header set to super_admin token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_super_admin_user.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest_asyncio.fixture
async def npo_admin_client(async_client: AsyncClient, test_npo_admin_user: Any) -> AsyncClient:
    """
    Create authenticated async test client with npo_admin access token.

    Returns AsyncClient with Authorization header set to npo_admin token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_npo_admin_user.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest_asyncio.fixture
async def event_coordinator_client(
    async_client: AsyncClient, test_event_coordinator_user: Any
) -> AsyncClient:
    """
    Create authenticated async test client with event_coordinator access token.

    Returns AsyncClient with Authorization header set to event_coordinator token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_event_coordinator_user.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest_asyncio.fixture
async def donor_client(async_client: AsyncClient, test_donor_user: Any) -> AsyncClient:
    """
    Create authenticated async test client with donor access token.

    Returns AsyncClient with Authorization header set to donor token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_donor_user.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest.fixture
async def test_user_2(
    db_session: AsyncSession,
) -> User:
    """
    Create a second test user (donor role).

    Used for testing multi-user scenarios and permissions between different users.
    """
    from sqlalchemy import text

    from app.core.security import hash_password

    # Get donor role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
    donor_role_id = role_result.scalar_one()

    user = User(
        email="testuser2@example.com",
        password_hash=hash_password("TestPass123"),
        first_name="Jane",
        last_name="Smith",
        role_id=donor_role_id,
        email_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def authenticated_client_2(
    async_client: AsyncClient,
    test_user_2: User,
) -> AsyncClient:
    """
    Create authenticated async test client for test_user_2.

    Returns AsyncClient with Authorization header set to test_user_2 token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user_2.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest.fixture
async def authenticated_superadmin_client(
    async_client: AsyncClient,
    test_super_admin_user: User,
) -> AsyncClient:
    """
    Alias for super_admin_client for consistency with naming conventions.

    Returns AsyncClient with Authorization header set to super_admin token.
    """
    # Clear rate limiting from Redis to avoid conflicts from previous test runs
    from app.core.redis import get_redis

    redis_client = await get_redis()
    await redis_client.flushdb()

    # Login to get access token
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_super_admin_user.email,
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200, f"Login failed: {response.json()}"
    data = response.json()
    access_token = data["access_token"]

    # Set authorization header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


# Legal documentation fixtures


@pytest_asyncio.fixture
async def admin_auth_headers(test_super_admin_token: str) -> dict[str, str]:
    """
    Get authorization headers for admin user (super_admin).

    Returns dictionary with Authorization header containing Bearer token.
    Used for testing admin-only endpoints in legal documentation system.
    """
    return {"Authorization": f"Bearer {test_super_admin_token}"}


@pytest_asyncio.fixture
async def user_auth_headers(test_donor_token: str) -> dict[str, str]:
    """
    Get authorization headers for regular user (donor).

    Returns dictionary with Authorization header containing Bearer token.
    Used for testing user endpoints that require authentication.
    """
    return {"Authorization": f"Bearer {test_donor_token}"}


@pytest_asyncio.fixture
async def user_id(test_donor_user: Any) -> str:
    """
    Get test donor user ID as string.

    Returns the UUID string of the test donor user.
    Used for verification in database queries.
    """
    return str(test_donor_user.id)


@pytest_asyncio.fixture
async def published_legal_documents(
    async_client: AsyncClient,
    admin_auth_headers: dict[str, str],
) -> dict[str, str]:
    """
    Create and publish initial legal documents (TOS v1.0 and Privacy v1.0).

    Returns dictionary with document IDs:
    - tos_id: UUID of published Terms of Service v1.0
    - privacy_id: UUID of published Privacy Policy v1.0

    These are used as base documents for consent testing.
    """
    # Create TOS v1.0
    tos_payload = {
        "document_type": "terms_of_service",
        "version": "1.0",
        "content": "# Terms of Service v1.0\n\nInitial terms...",
    }
    tos_response = await async_client.post(
        "/api/v1/legal/admin/documents",
        json=tos_payload,
        headers=admin_auth_headers,
    )
    assert tos_response.status_code == 201
    tos_id = tos_response.json()["id"]

    # Publish TOS
    publish_tos_response = await async_client.post(
        f"/api/v1/legal/admin/documents/{tos_id}/publish",
        headers=admin_auth_headers,
    )
    assert publish_tos_response.status_code == 200

    # Create Privacy v1.0
    privacy_payload = {
        "document_type": "privacy_policy",
        "version": "1.0",
        "content": "# Privacy Policy v1.0\n\nInitial privacy policy...",
    }
    privacy_response = await async_client.post(
        "/api/v1/legal/admin/documents",
        json=privacy_payload,
        headers=admin_auth_headers,
    )
    assert privacy_response.status_code == 201
    privacy_id = privacy_response.json()["id"]

    # Publish Privacy
    publish_privacy_response = await async_client.post(
        f"/api/v1/legal/admin/documents/{privacy_id}/publish",
        headers=admin_auth_headers,
    )
    assert publish_privacy_response.status_code == 200

    return {
        "tos_id": tos_id,
        "privacy_id": privacy_id,
    }


# ================================
# NPO Fixtures
# ================================


@pytest_asyncio.fixture
async def test_npo(db_session: AsyncSession, test_user: Any) -> Any:
    """
    Create a test NPO for testing.

    Returns an NPO in DRAFT status with test_user as admin member.
    """
    from app.models.npo import NPO, NPOStatus
    from app.models.npo_member import MemberRole, MemberStatus, NPOMember

    # Create NPO
    npo = NPO(
        name="Test NPO Organization",
        description="A test non-profit organization for testing",
        mission_statement="Help people test software properly",
        email="test@testnpo.org",
        phone="+1-555-0100",
        website_url="https://testnpo.org",
        tax_id="12-3456789",
        address={
            "street": "123 Test St",
            "city": "Test City",
            "state": "TS",
            "zipCode": "12345",
            "country": "US",
        },
        registration_number="REG123456",
        status=NPOStatus.DRAFT,
        created_by_user_id=test_user.id,
    )
    db_session.add(npo)
    await db_session.flush()

    # Add creator as admin member
    member = NPOMember(
        npo_id=npo.id,
        user_id=test_user.id,
        role=MemberRole.ADMIN,
        status=MemberStatus.ACTIVE,
    )
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(npo)

    return npo


@pytest_asyncio.fixture
async def test_npo_2(db_session: AsyncSession, test_super_admin_user: Any) -> Any:
    """
    Create a second test NPO for testing.

    Returns an NPO in DRAFT status with superadmin as creator.
    """
    from app.models.npo import NPO, NPOStatus
    from app.models.npo_member import MemberRole, MemberStatus, NPOMember

    # Create NPO
    npo = NPO(
        name="Second Test NPO",
        description="Another test organization",
        mission_statement="Testing multiple NPOs",
        email="test2@testnpo.org",
        phone="+1-555-0200",
        status=NPOStatus.DRAFT,
        created_by_user_id=test_super_admin_user.id,
    )
    db_session.add(npo)
    await db_session.flush()

    # Add creator as admin member
    member = NPOMember(
        npo_id=npo.id,
        user_id=test_super_admin_user.id,
        role=MemberRole.ADMIN,
        status=MemberStatus.ACTIVE,
    )
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(npo)

    return npo


@pytest_asyncio.fixture
async def superadmin_user(db_session: AsyncSession) -> Any:
    """
    Alias for test_super_admin_user for consistency.
    """
    from sqlalchemy import text

    from app.core.security import hash_password
    from app.models.user import User

    # Get super_admin role_id from database
    role_result = await db_session.execute(text("SELECT id FROM roles WHERE name = 'super_admin'"))
    superadmin_role_id = role_result.scalar_one()

    # Create super admin user
    user = User(
        email="superadmin@example.com",
        first_name="Super",
        last_name="Admin",
        phone="+1-555-0001",
        password_hash=hash_password("AdminPass123"),
        email_verified=True,
        is_active=True,
        role_id=superadmin_role_id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Add role_name attribute (normally attached by auth middleware)
    user.role_name = "super_admin"  # type: ignore[attr-defined]

    return user


# ================================
# NPO Member & Invitation Fixtures
# ================================


@pytest_asyncio.fixture
async def test_staff_member(db_session: AsyncSession, test_npo: Any, test_staff_user: Any) -> Any:
    """
    Create a staff member in the test NPO.

    Returns an NPOMember instance with STAFF role.
    """
    from app.models.npo_member import MemberRole, MemberStatus, NPOMember

    member = NPOMember(
        npo_id=test_npo.id,
        user_id=test_staff_user.id,
        role=MemberRole.STAFF,
        status=MemberStatus.ACTIVE,
    )
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(member)

    return member


@pytest_asyncio.fixture
async def authenticated_staff_client(
    async_client: AsyncClient, test_staff_user: Any, test_staff_member: Any
) -> AsyncClient:
    """
    Create an authenticated async client for staff user.

    Returns AsyncClient with valid auth token in headers.
    """
    # Login to get token
    login_data = {"email": test_staff_user.email, "password": "TestPass123"}
    response = await async_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token_data = response.json()
    access_token = token_data["access_token"]

    # Set auth header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest_asyncio.fixture
async def test_npo_other_user(db_session: AsyncSession, test_user_2: Any) -> Any:
    """
    Create an NPO owned by test_user_2 for cross-NPO permission testing.

    Returns NPO owned by test_user_2 (different from test_npo).
    """
    from app.models.npo import NPO, NPOStatus
    from app.models.npo_member import MemberRole, MemberStatus, NPOMember

    # Create NPO for test_user_2
    npo = NPO(
        name="Other User NPO",
        mission_statement="NPO for cross-NPO permission testing",
        description="Used for testing that users can't access other NPOs",
        tax_id="98-7654321",
        email="otheruser@example.com",  # Email is required
        status=NPOStatus.APPROVED,
        created_by_user_id=test_user_2.id,
    )
    db_session.add(npo)
    await db_session.commit()
    await db_session.refresh(npo)

    # Create admin member for test_user_2
    member = NPOMember(
        npo_id=npo.id,
        user_id=test_user_2.id,
        role=MemberRole.ADMIN,
        status=MemberStatus.ACTIVE,
    )
    db_session.add(member)
    await db_session.commit()

    return npo


@pytest_asyncio.fixture
async def authenticated_client_other_user(
    async_client: AsyncClient, test_user_2: Any, test_npo_other_user: Any
) -> AsyncClient:
    """
    Create an authenticated async client for a different user.

    Returns AsyncClient with valid auth token for test_user_2 who is admin of test_npo_other_user.
    """
    # Login to get token
    login_data = {"email": test_user_2.email, "password": "TestPass123"}
    response = await async_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    token_data = response.json()
    access_token = token_data["access_token"]

    # Set auth header for subsequent requests
    async_client.headers["Authorization"] = f"Bearer {access_token}"

    return async_client


@pytest_asyncio.fixture
async def test_invitation_token(
    db_session: AsyncSession, test_npo: Any, test_user: Any, test_invited_user: Any
) -> str:
    """
    Create a valid invitation token for testing.

    Returns invitation ID as token string for acceptance.
    NOTE: Depends on test_invited_user to ensure user exists with matching email.
    """
    import hashlib
    import uuid
    from datetime import UTC, datetime, timedelta

    from app.models.invitation import Invitation, InvitationStatus

    # Generate a simple token hash for testing
    token = f"test-token-{uuid.uuid4()}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Create invitation
    invitation = Invitation(
        npo_id=test_npo.id,
        email="invited@example.com",  # Matches test_invited_user email
        role="staff",
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        invited_by_user_id=test_user.id,
        token_hash=token_hash,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    return str(invitation.id)


@pytest_asyncio.fixture
async def test_invited_user(db_session: AsyncSession) -> Any:
    """
    Create a user for invitation acceptance testing.
    Email matches the invitation email in test_invitation_token fixture.
    """
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models.role import Role
    from app.models.user import User

    # Get or create donor role
    stmt = select(Role).where(Role.name == "donor")
    result = await db_session.execute(stmt)
    donor_role = result.scalar_one_or_none()

    if not donor_role:
        donor_role = Role(name="donor", description="Regular donor user")
        db_session.add(donor_role)
        await db_session.flush()

    user = User(
        email="invited@example.com",
        password_hash=hash_password("Password123!"),
        first_name="Invited",
        last_name="User",
        email_verified=True,
        is_active=True,
        role_id=donor_role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_expired_user(db_session: AsyncSession) -> Any:
    """
    Create a user for expired invitation testing.
    Email matches the expired invitation email.
    """
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models.role import Role
    from app.models.user import User

    # Get or create donor role
    stmt = select(Role).where(Role.name == "donor")
    result = await db_session.execute(stmt)
    donor_role = result.scalar_one_or_none()

    if not donor_role:
        donor_role = Role(name="donor", description="Regular donor user")
        db_session.add(donor_role)
        await db_session.flush()

    user = User(
        email="expired@example.com",
        password_hash=hash_password("Password123!"),
        first_name="Expired",
        last_name="User",
        email_verified=True,
        is_active=True,
        role_id=donor_role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_accepted_user(db_session: AsyncSession) -> Any:
    """
    Create a user for accepted invitation testing.
    Email matches the accepted invitation email.
    """
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models.role import Role
    from app.models.user import User

    # Get or create donor role
    stmt = select(Role).where(Role.name == "donor")
    result = await db_session.execute(stmt)
    donor_role = result.scalar_one_or_none()

    if not donor_role:
        donor_role = Role(name="donor", description="Regular donor user")
        db_session.add(donor_role)
        await db_session.flush()

    user = User(
        email="accepted@example.com",
        password_hash=hash_password("Password123!"),
        first_name="Accepted",
        last_name="User",
        email_verified=True,
        is_active=True,
        role_id=donor_role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_revoked_user(db_session: AsyncSession) -> Any:
    """
    Create a user for revoked invitation testing.
    Email matches the revoked invitation email.
    """
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.models.role import Role
    from app.models.user import User

    # Get or create donor role
    stmt = select(Role).where(Role.name == "donor")
    result = await db_session.execute(stmt)
    donor_role = result.scalar_one_or_none()

    if not donor_role:
        donor_role = Role(name="donor", description="Regular donor user")
        db_session.add(donor_role)
        await db_session.flush()

    user = User(
        email="revoked@example.com",
        password_hash=hash_password("Password123!"),
        first_name="Revoked",
        last_name="User",
        email_verified=True,
        is_active=True,
        role_id=donor_role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_expired_invitation_token(
    db_session: AsyncSession, test_npo: Any, test_user: Any, test_expired_user: Any
) -> str:
    """
    Create an expired invitation token for testing.

    Returns invitation ID as token string for expired invitation.
    NOTE: Depends on test_expired_user to ensure user exists with matching email.
    """
    import hashlib
    import uuid
    from datetime import UTC, datetime, timedelta

    from app.models.invitation import Invitation, InvitationStatus

    # Generate a simple token hash for testing
    token = f"test-token-expired-{uuid.uuid4()}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Create expired invitation
    invitation = Invitation(
        npo_id=test_npo.id,
        email="expired@example.com",  # Matches test_expired_user email
        role="staff",
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(UTC) - timedelta(days=1),
        invited_by_user_id=test_user.id,
        token_hash=token_hash,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    return str(invitation.id)


@pytest_asyncio.fixture
async def test_accepted_invitation_token(
    db_session: AsyncSession, test_npo: Any, test_user: Any, test_accepted_user: Any
) -> str:
    """
    Create an accepted invitation token for testing.

    Returns invitation ID as token string for already accepted invitation.
    NOTE: Depends on test_accepted_user to ensure user exists with matching email.
    """
    import hashlib
    import uuid
    from datetime import UTC, datetime, timedelta

    from app.models.invitation import Invitation, InvitationStatus

    # Generate a simple token hash for testing
    token = f"test-token-accepted-{uuid.uuid4()}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Create accepted invitation
    invitation = Invitation(
        npo_id=test_npo.id,
        email="accepted@example.com",  # Matches test_accepted_user email
        role="staff",
        status=InvitationStatus.ACCEPTED,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        invited_by_user_id=test_user.id,
        token_hash=token_hash,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    return str(invitation.id)


@pytest_asyncio.fixture
async def test_revoked_invitation_token(
    db_session: AsyncSession, test_npo: Any, test_user: Any, test_revoked_user: Any
) -> str:
    """
    Create a revoked invitation token for testing.

    Returns invitation ID as token string for revoked invitation.
    NOTE: Depends on test_revoked_user to ensure user exists with matching email.
    """
    import hashlib
    import uuid
    from datetime import UTC, datetime, timedelta

    from app.models.invitation import Invitation, InvitationStatus

    # Generate a simple token hash for testing
    token = f"test-token-revoked-{uuid.uuid4()}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Create revoked invitation
    invitation = Invitation(
        npo_id=test_npo.id,
        email="revoked@example.com",  # Matches test_revoked_user email
        role="staff",
        status=InvitationStatus.REVOKED,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        invited_by_user_id=test_user.id,
        token_hash=token_hash,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    return str(invitation.id)


@pytest_asyncio.fixture
async def test_invitation_token_existing_member(
    db_session: AsyncSession, test_npo: Any, test_user: Any
) -> str:
    """
    Create an invitation for a user who is already a member.

    Returns invitation ID as token string for invitation to existing member.
    """
    import hashlib
    import uuid
    from datetime import UTC, datetime, timedelta

    from app.models.invitation import Invitation, InvitationStatus

    # Generate a simple token hash for testing
    token = f"test-token-existing-{uuid.uuid4()}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Create invitation for existing member's email
    invitation = Invitation(
        npo_id=test_npo.id,
        email=test_user.email,  # User who is already a member
        role="staff",
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        invited_by_user_id=test_user.id,
        token_hash=token_hash,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    return str(invitation.id)


# ================================
# Event Fixtures
# ================================


@pytest_asyncio.fixture
async def test_approved_npo(db_session: AsyncSession, test_npo_admin_user: Any) -> Any:
    """
    Create a test NPO in APPROVED status for event creation.

    Returns an NPO with status=APPROVED and test_npo_admin_user as admin member.
    Events can only be created for APPROVED NPOs.
    """
    from app.models.npo import NPO, NPOStatus
    from app.models.npo_member import MemberRole, MemberStatus, NPOMember

    # Create NPO
    npo = NPO(
        name="Approved Test NPO",
        description="An approved non-profit organization for event testing",
        mission_statement="Host amazing fundraising events",
        email="approved@testnpo.org",
        phone="+1-555-0300",
        website_url="https://approved-testnpo.org",
        tax_id="99-8877665",
        address={
            "street": "456 Event St",
            "city": "Event City",
            "state": "EC",
            "zipCode": "54321",
            "country": "US",
        },
        registration_number="REG999888",
        status=NPOStatus.APPROVED,
        created_by_user_id=test_npo_admin_user.id,
    )
    db_session.add(npo)
    await db_session.flush()

    # Add creator as admin member
    member = NPOMember(
        npo_id=npo.id,
        user_id=test_npo_admin_user.id,
        role=MemberRole.ADMIN,
        status=MemberStatus.ACTIVE,
    )
    db_session.add(member)

    # IMPORTANT: Update the user's npo_id to match this NPO
    # This is needed for permission filtering in list_events
    test_npo_admin_user.npo_id = npo.id

    await db_session.commit()
    await db_session.refresh(npo)
    await db_session.refresh(test_npo_admin_user)

    return npo


@pytest_asyncio.fixture
async def test_event(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Any:
    """
    Create a test event in DRAFT status.

    Returns an Event instance with sample data in DRAFT status.
    """
    from datetime import UTC, datetime, timedelta

    from app.models.event import Event, EventStatus

    event = Event(
        npo_id=test_approved_npo.id,
        name="Annual Gala 2025",
        slug="annual-gala-2025",
        status=EventStatus.DRAFT,
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/New_York",
        venue_name="Grand Ballroom",
        venue_address="789 Gala Ave, New York, NY 10001",
        description="Our annual fundraising gala with silent auction and dinner.",
        logo_url="https://example.com/logo.png",
        primary_color="#1a73e8",
        secondary_color="#34a853",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    return event


@pytest_asyncio.fixture
async def test_active_event(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Any:
    """
    Create a test event in ACTIVE status for public access testing.

    Returns an Event instance with ACTIVE status.
    """
    from datetime import UTC, datetime, timedelta

    from app.models.event import Event, EventStatus

    event = Event(
        npo_id=test_approved_npo.id,
        name="Summer Fundraiser 2025",
        slug="summer-fundraiser-2025",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=60),
        timezone="America/Los_Angeles",
        venue_name="Beach Club",
        venue_address="123 Beach Blvd, Los Angeles, CA 90001",
        description="Join us for a summer evening of fun and fundraising!",
        logo_url="https://example.com/summer-logo.png",
        primary_color="#ff6b35",
        secondary_color="#004e89",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    return event


@pytest_asyncio.fixture
async def test_registration(db_session: AsyncSession, test_event: Any, test_donor_user: Any) -> Any:
    """
    Create a test EventRegistration for seating and bidder number tests.

    Returns an EventRegistration instance linking test_donor_user to test_event.
    """
    from app.models.event_registration import EventRegistration, RegistrationStatus

    registration = EventRegistration(
        event_id=test_event.id,
        user_id=test_donor_user.id,
        status=RegistrationStatus.CONFIRMED,
        number_of_guests=2,
    )
    db_session.add(registration)
    await db_session.commit()
    await db_session.refresh(registration)

    return registration


@pytest_asyncio.fixture
async def test_donor(test_donor_user: Any) -> Any:
    """Alias for test_donor_user for backward compatibility."""
    return test_donor_user


# ================================
# Mock Azure Storage Fixture
# ================================


@pytest.fixture(autouse=True)
def mock_azure_storage(monkeypatch):
    """Mock Azure Blob Storage for tests that don't need actual storage."""
    from unittest.mock import MagicMock

    from app.core.config import get_settings

    # Set environment variables for Azure Storage
    monkeypatch.setenv(
        "AZURE_STORAGE_CONNECTION_STRING",
        "DefaultEndpointsProtocol=https;AccountName=teststorage;AccountKey=dGVzdGtleQ==;EndpointSuffix=core.windows.net",
    )
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_NAME", "teststorage")
    monkeypatch.setenv("AZURE_STORAGE_CONTAINER_NAME", "test-container")

    # Clear settings cache to force reload with new env vars
    get_settings.cache_clear()

    # IMPORTANT: Patch the module-level settings object in sponsor_logo_service
    # It was already instantiated at import time, so env vars won't help
    mock_connection_string = "DefaultEndpointsProtocol=https;AccountName=teststorage;AccountKey=dGVzdGtleQ==;EndpointSuffix=core.windows.net"

    # Import the module and patch its settings object directly
    from app.services import sponsor_logo_service

    monkeypatch.setattr(
        sponsor_logo_service.settings,
        "azure_storage_connection_string",
        mock_connection_string,
    )

    # Mock the BlobServiceClient with unique URLs per blob
    mock_blob_service = MagicMock()

    def mock_get_blob_client(container, blob):
        """Return a mock blob client with unique URL based on blob name."""
        mock_blob_client = MagicMock()
        mock_blob_client.url = f"https://teststorage.blob.core.windows.net/{container}/{blob}"
        return mock_blob_client

    mock_blob_service.get_blob_client = mock_get_blob_client

    # Mock the generate_blob_sas function
    def mock_generate_sas(*args, **kwargs):
        # Use timestamp to ensure unique tokens for each call
        import time

        timestamp = str(time.time())
        blob_name = kwargs.get("blob_name", "test-blob")
        return f"mock_sas_token=test&sig=mocksignature-{blob_name[:8]}-{timestamp}"

    monkeypatch.setattr(
        "app.services.file_upload_service.BlobServiceClient.from_connection_string",
        lambda *args, **kwargs: mock_blob_service,
    )
    monkeypatch.setattr(
        "app.services.file_upload_service.generate_blob_sas",
        mock_generate_sas,
    )

    # Also mock for sponsor_logo_service
    monkeypatch.setattr(
        "app.services.sponsor_logo_service.BlobServiceClient.from_connection_string",
        lambda *args, **kwargs: mock_blob_service,
    )
    monkeypatch.setattr(
        "app.services.sponsor_logo_service.generate_blob_sas",
        mock_generate_sas,
    )

    return mock_blob_service
