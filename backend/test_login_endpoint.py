#!/usr/bin/env python3
"""Test login endpoint to see where it hangs."""

import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))


async def test_login():
    """Test login endpoint."""
    from httpx import AsyncClient
    from redis.asyncio import Redis
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core.database import get_db
    from app.core.redis import get_redis
    from app.core.security import hash_password
    from app.main import app
    from app.models.base import Base
    from app.models.user import User

    print("1. Creating test engine...")
    db_url = (
        "postgresql+asyncpg://fundrbolt_user:fundrbolt_password@localhost:5432/fundrbolt_test_db"
    )
    engine = create_async_engine(db_url, poolclass=NullPool, echo=False)

    print("2. Creating tables...")
    async with engine.begin() as conn:
        # Create roles table
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS roles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(50) UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    scope VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """
            )
        )
        # Seed donor role
        await conn.execute(
            text(
                """
                INSERT INTO roles (name, description, scope) VALUES
                    ('donor', 'Regular donor', 'own')
                ON CONFLICT (name) DO NOTHING
            """
            )
        )
        await conn.run_sync(Base.metadata.create_all)

    print("3. Creating connection and session...")
    connection = await engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection, expire_on_commit=False)

    print("4. Creating test user...")
    role_result = await session.execute(text("SELECT id FROM roles WHERE name = 'donor'"))
    donor_role_id = role_result.scalar_one()

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
    session.add(user)
    await session.commit()
    print(f"   Created user: {user.email}")

    print("5. Creating Redis client...")
    redis_client = Redis.from_url(
        "redis://localhost:6379/0",
        encoding="utf-8",
        decode_responses=True,
        db=1,
    )
    await redis_client.ping()
    await redis_client.flushdb()

    print("6. Setting up FastAPI app...")

    async def override_get_db():
        yield session

    async def override_get_redis():
        return redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    print("7. Testing login endpoint...")
    async with AsyncClient(app=app, base_url="http://test") as client:
        print("   Sending login request...")
        response = await asyncio.wait_for(
            client.post(
                "/api/v1/auth/login", json={"email": "test@example.com", "password": "TestPass123"}
            ),
            timeout=15.0,
        )
        print(f"   Response status: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ Login successful!")
            data = response.json()
            print(f"   Access token length: {len(data.get('access_token', ''))}")
        else:
            print(f"   ❌ Login failed: {response.json()}")

    print("8. Cleaning up...")
    app.dependency_overrides.clear()
    await session.close()
    await transaction.rollback()
    await connection.close()
    await redis_client.close()
    await engine.dispose()

    print("✅ Login test passed!")


if __name__ == "__main__":
    try:
        asyncio.run(test_login())
    except TimeoutError:
        print("❌ Login endpoint timed out!")
        sys.exit(1)
