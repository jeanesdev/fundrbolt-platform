#!/usr/bin/env python3
"""Test individual fixtures to find which one hangs."""

import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))


async def test_async_client_fixture():
    """Test if we can create an async client."""
    from httpx import AsyncClient
    from redis.asyncio import Redis
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core.database import get_db
    from app.core.redis import get_redis
    from app.main import app

    print("1. Creating test engine...")
    db_url = "postgresql+asyncpg://augeo_user:augeo_password@localhost:5432/augeo_test_db"
    engine = create_async_engine(db_url, poolclass=NullPool, echo=False)

    print("2. Creating connection and session...")
    connection = await engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection, expire_on_commit=False)

    print("3. Creating Redis client...")
    redis_client = Redis.from_url(
        "redis://localhost:6379/0",
        encoding="utf-8",
        decode_responses=True,
        db=1,
    )
    await redis_client.ping()

    print("4. Overriding dependencies...")

    async def override_get_db():
        yield session

    async def override_get_redis():
        return redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    print("5. Creating AsyncClient...")
    async with AsyncClient(app=app, base_url="http://test") as test_client:
        print("6. Testing a simple request...")
        response = await test_client.get("/health")
        print(f"   Response status: {response.status_code}")

    print("7. Cleaning up...")
    app.dependency_overrides.clear()
    await session.close()
    await transaction.rollback()
    await connection.close()
    await redis_client.close()
    await engine.dispose()

    print("✅ async_client fixture test passed!")


if __name__ == "__main__":
    asyncio.run(test_async_client_fixture())
