"""Database configuration and session management."""

import asyncio
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import DB_FAILURES_TOTAL

settings = get_settings()
logger = get_logger(__name__)

# Convert postgresql:// to postgresql+asyncpg:// for async support
database_url = str(settings.database_url)
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Create async engine
async_engine = create_async_engine(
    database_url,
    echo=settings.debug,
    future=True,
    pool_pre_ping=True,
    poolclass=NullPool,  # Always use NullPool for better test isolation
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, Any]:
    """Dependency for getting async database sessions with error handling.

    Yields:
        AsyncSession: Database session

    Raises:
        OperationalError: Database connection failure
        SQLAlchemyError: Other database errors

    Example:
        @router.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    max_retries = 3
    retry_delay = 1.0  # seconds

    for attempt in range(max_retries):
        try:
            async with AsyncSessionLocal() as session:
                try:
                    yield session
                    await session.commit()
                except SQLAlchemyError as e:
                    await session.rollback()
                    logger.exception(
                        "Database error during transaction",
                        extra={"error": str(e), "attempt": attempt + 1},
                    )
                    raise
                except Exception as e:
                    await session.rollback()
                    logger.exception(
                        "Unexpected error during transaction",
                        extra={"error": str(e), "attempt": attempt + 1},
                    )
                    raise
                finally:
                    await session.close()
            break  # Success, exit retry loop

        except OperationalError as e:
            # Increment failure counter
            DB_FAILURES_TOTAL.inc()

            if attempt < max_retries - 1:
                logger.warning(
                    "Database connection failed, retrying",
                    extra={
                        "error": str(e),
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "retry_delay": retry_delay,
                    },
                )
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error(
                    "Database connection failed after all retries",
                    extra={
                        "error": str(e),
                        "max_retries": max_retries,
                    },
                )
                raise
