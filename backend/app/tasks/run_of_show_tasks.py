"""Celery tasks for Run-of-Show notification delivery."""

import asyncio
import uuid
from typing import Any

from app.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger

logger = get_logger(__name__)


def _run_async(coro: Any) -> Any:
    """Run an async coroutine from a sync Celery task."""
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
    name="app.tasks.run_of_show_tasks.send_ros_notification_task",
    max_retries=2,
    default_retry_delay=60,
)
def send_ros_notification_task(self: Any, notification_id: str) -> None:
    """Send a scheduled run-of-show notification."""
    logger.info(
        "Running send_ros_notification_task",
        extra={"notification_id": notification_id},
    )
    _run_async(_send_ros_notification_async(notification_id))


async def _send_ros_notification_async(notification_id_str: str) -> None:
    """Async implementation of RoS notification delivery."""
    from datetime import UTC, datetime

    from sqlalchemy import select

    from app.models.notification import NotificationPriorityEnum, NotificationTypeEnum
    from app.models.run_of_show import (
        RosDeliveryStatusEnum,
        RunOfShowItem,
        ScheduledRunOfShowNotification,
    )
    from app.services.notification_service import NotificationService

    notif_id = uuid.UUID(notification_id_str)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(ScheduledRunOfShowNotification).where(
                    ScheduledRunOfShowNotification.id == notif_id
                )
            )
            notification = result.scalar_one_or_none()
            if notification is None:
                logger.warning(f"RoS notification {notif_id} not found")
                return

            if notification.delivery_status != RosDeliveryStatusEnum.PENDING:
                logger.info(
                    f"RoS notification {notif_id} already in status "
                    f"{notification.delivery_status.value}, skipping"
                )
                return

            # Get the RoS item to find the event_id
            item_result = await db.execute(
                select(RunOfShowItem).where(RunOfShowItem.id == notification.ros_item_id)
            )
            ros_item = item_result.scalar_one_or_none()
            if ros_item is None:
                notification.delivery_status = RosDeliveryStatusEnum.FAILED
                notification.failure_reason = "Associated RoS item not found"
                await db.commit()
                return

            # Get all registered user IDs for this event
            from app.models.event_registration import EventRegistration

            reg_result = await db.execute(
                select(EventRegistration.user_id).where(
                    EventRegistration.event_id == ros_item.event_id,
                    EventRegistration.user_id.is_not(None),
                )
            )
            user_ids = [row[0] for row in reg_result.all()]

            recipient_type = notification.recipient_type.value
            if recipient_type in ("donors", "all_attendees"):
                for user_id in user_ids:
                    try:
                        await NotificationService.create_notification(
                            db=db,
                            event_id=ros_item.event_id,
                            user_id=user_id,
                            notification_type=NotificationTypeEnum.CUSTOM,
                            title="Event Update",
                            body=notification.message_body,
                            priority=NotificationPriorityEnum.NORMAL,
                            dispatch_tasks=True,
                        )
                    except Exception:
                        logger.exception(f"Failed to send RoS notification to user {user_id}")

            notification.delivery_status = RosDeliveryStatusEnum.DELIVERED
            notification.delivered_at = datetime.now(UTC)
            await db.commit()
            logger.info(f"Delivered RoS notification {notif_id} to {len(user_ids)} users")

        except Exception as exc:
            await db.rollback()
            logger.exception(f"Failed to deliver RoS notification {notif_id}: {exc}")
            async with AsyncSessionLocal() as db2:
                r2 = await db2.execute(
                    select(ScheduledRunOfShowNotification).where(
                        ScheduledRunOfShowNotification.id == notif_id
                    )
                )
                notification_obj = r2.scalar_one_or_none()
                if notification_obj:
                    notification_obj.delivery_status = RosDeliveryStatusEnum.FAILED
                    notification_obj.failure_reason = str(exc)
                    await db2.commit()
            raise
