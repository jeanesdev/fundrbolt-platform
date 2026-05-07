"""Celery tasks for donor event checkout automation."""

from typing import Any

from app.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)


def _run_async(coro: Any) -> Any:
    """Run an async coroutine from a sync Celery task."""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@celery_app.task(  # type: ignore[misc]
    bind=True,
    name="app.tasks.checkout_tasks.auto_open_checkout_task",
    max_retries=2,
    default_retry_delay=60,
)
def auto_open_checkout_task(self: Any, event_id_str: str) -> None:
    """Auto-open checkout for an event at the scheduled time."""
    logger.info(
        "Running auto_open_checkout_task",
        extra={"event_id": event_id_str},
    )
    try:
        _run_async(_auto_open_checkout_async(event_id_str))
    except Exception as exc:
        logger.exception(
            f"auto_open_checkout_task failed for event {event_id_str}, will retry",
            extra={"event_id": event_id_str},
        )
        raise self.retry(exc=exc)


async def _auto_open_checkout_async(event_id_str: str) -> None:
    """Async implementation of auto-open checkout."""
    import uuid

    from app.core.database import AsyncSessionLocal
    from app.services.checkout_configuration_service import CheckoutConfigurationService

    event_id = uuid.UUID(event_id_str)

    async with AsyncSessionLocal() as db:
        try:
            service = CheckoutConfigurationService(db)
            await service.open_checkout(event_id)
            await db.commit()
            logger.info(f"Auto-opened checkout for event {event_id_str}")
        except Exception as exc:
            await db.rollback()
            logger.exception(f"Failed to auto-open checkout for event {event_id_str}: {exc}")
            raise
