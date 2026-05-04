"""Run-of-Show Notification Service."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run_of_show import (
    RosDeliveryStatusEnum,
    RosRecipientTypeEnum,
    RunOfShowItem,
    ScheduledRunOfShowNotification,
)
from app.schemas.run_of_show import RosNotificationResponse

logger = logging.getLogger(__name__)


class RunOfShowNotificationService:
    """Service for managing scheduled RoS notifications."""

    @staticmethod
    async def get_notification_for_item(
        db: AsyncSession,
        item_id: uuid.UUID,
    ) -> ScheduledRunOfShowNotification | None:
        """Get the notification for a RoS item, or None if not set."""
        result = await db.execute(
            select(ScheduledRunOfShowNotification).where(
                ScheduledRunOfShowNotification.ros_item_id == item_id
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def schedule_notification(
        db: AsyncSession,
        ros_item_id: uuid.UUID,
        message_body: str,
        recipient_type: RosRecipientTypeEnum,
    ) -> ScheduledRunOfShowNotification:
        """Schedule a notification for a RoS item."""
        # Check for existing notification
        existing = await RunOfShowNotificationService.get_notification_for_item(db, ros_item_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A notification already exists for this item. Delete it first.",
            )

        # Get the RoS item for scheduled_time
        item_result = await db.execute(select(RunOfShowItem).where(RunOfShowItem.id == ros_item_id))
        item = item_result.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Run-of-show item not found",
            )

        notification = ScheduledRunOfShowNotification(
            id=uuid.uuid4(),
            ros_item_id=ros_item_id,
            message_body=message_body,
            recipient_type=recipient_type,
            scheduled_at=item.scheduled_time,
            delivery_status=RosDeliveryStatusEnum.PENDING,
            celery_task_id=None,
        )
        db.add(notification)
        await db.flush()

        # Schedule Celery task
        try:
            from app.tasks.run_of_show_tasks import send_ros_notification_task

            task = send_ros_notification_task.apply_async(
                args=[str(notification.id)],
                eta=item.scheduled_time,
            )
            notification.celery_task_id = task.id
        except Exception:
            logger.exception(
                f"Failed to schedule Celery task for RoS notification {notification.id}"
            )
            notification.delivery_status = RosDeliveryStatusEnum.FAILED
            notification.failure_reason = "Celery scheduling failed"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to schedule notification — please try again.",
            )

        await db.commit()
        await db.refresh(notification)
        logger.info(f"Scheduled RoS notification {notification.id} for item {ros_item_id}")
        return notification

    @staticmethod
    async def cancel_notification(
        db: AsyncSession,
        notification_id: uuid.UUID,
    ) -> None:
        """Cancel a scheduled notification."""
        result = await db.execute(
            select(ScheduledRunOfShowNotification).where(
                ScheduledRunOfShowNotification.id == notification_id
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return

        # Revoke Celery task
        if notification.celery_task_id:
            try:
                from app.celery_app import celery_app

                celery_app.control.revoke(notification.celery_task_id, terminate=False)
            except Exception:
                logger.warning(f"Failed to revoke Celery task {notification.celery_task_id}")

        notification.delivery_status = RosDeliveryStatusEnum.CANCELLED
        await db.commit()

    @staticmethod
    async def cancel_notification_for_item(
        db: AsyncSession,
        item_id: uuid.UUID,
    ) -> None:
        """Cancel the notification for a specific RoS item."""
        notification = await RunOfShowNotificationService.get_notification_for_item(db, item_id)
        if notification is None:
            return
        await RunOfShowNotificationService.cancel_notification(db, notification.id)

    @staticmethod
    async def cancel_all_pending_for_event(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> None:
        """Cancel all pending notifications for a given event."""
        result = await db.execute(
            select(ScheduledRunOfShowNotification)
            .join(
                RunOfShowItem,
                ScheduledRunOfShowNotification.ros_item_id == RunOfShowItem.id,
            )
            .where(
                RunOfShowItem.event_id == event_id,
                ScheduledRunOfShowNotification.delivery_status == RosDeliveryStatusEnum.PENDING,
            )
        )
        notifications = list(result.scalars().all())
        for notif in notifications:
            await RunOfShowNotificationService.cancel_notification(db, notif.id)
        logger.info(
            f"Cancelled {len(notifications)} pending RoS notifications for event {event_id}"
        )

    @staticmethod
    def notification_to_response(
        notification: ScheduledRunOfShowNotification,
    ) -> RosNotificationResponse:
        """Convert ORM to response schema."""
        return RosNotificationResponse(
            id=notification.id,
            ros_item_id=notification.ros_item_id,
            message_body=notification.message_body,
            recipient_type=notification.recipient_type.value,
            scheduled_at=notification.scheduled_at,
            delivery_status=notification.delivery_status.value,
            celery_task_id=notification.celery_task_id,
            delivered_at=notification.delivered_at,
            failure_reason=notification.failure_reason,
            created_at=notification.created_at,
            updated_at=notification.updated_at,
        )
