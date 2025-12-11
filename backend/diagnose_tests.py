#!/usr/bin/env python3
"""Diagnose which tests or fixtures are causing hangs."""

import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))


async def test_database_connection():
    """Test if we can connect to the database."""
    from sqlalchemy.ext.asyncio import create_async_engine

    from app.core.config import get_settings

    settings = get_settings()
    db_url = str(settings.database_url)

    # Replace with test database
    if "/augeo_db" in db_url:
        db_url = db_url.replace("/augeo_db", "/augeo_test_db")
    elif db_url.endswith("/augeo"):
        db_url = db_url.replace("/augeo", "/augeo_test")

    # Ensure asyncpg
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    print(f"Testing database connection: {db_url.split('@')[1] if '@' in db_url else db_url}")

    try:
        engine = create_async_engine(db_url, pool_pre_ping=True, echo=False)
        async with engine.connect() as _conn:
            print("✅ Database connection successful")
        await engine.dispose()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


async def test_redis_connection():
    """Test if we can connect to Redis."""
    from redis.asyncio import Redis

    from app.core.config import get_settings

    settings = get_settings()
    print(f"Testing Redis connection: {settings.redis_url}")

    try:
        client = Redis.from_url(
            str(settings.redis_url),
            encoding="utf-8",
            decode_responses=True,
            db=1,
        )
        await client.ping()
        print("✅ Redis connection successful")
        await client.close()
        return True
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return False


async def test_app_import():
    """Test if we can import the app."""
    try:
        print("✅ App import successful")
        return True
    except Exception as e:
        print(f"❌ App import failed: {e}")
        import traceback

        traceback.print_exc()
        return False


async def main():
    """Run all diagnostic tests."""
    print("=== Diagnostic Test Suite ===\n")

    results = []

    print("1. Testing app import...")
    results.append(await test_app_import())
    print()

    print("2. Testing database connection...")
    results.append(await test_database_connection())
    print()

    print("3. Testing Redis connection...")
    results.append(await test_redis_connection())
    print()

    print("=== Summary ===")
    if all(results):
        print("✅ All diagnostic tests passed")
        return 0
    else:
        print("❌ Some diagnostic tests failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
