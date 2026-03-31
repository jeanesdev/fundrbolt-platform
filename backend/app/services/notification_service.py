"""Core notification service for creating, querying, and managing notifications."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.notification import (
    DeliveryChannelEnum,
    DeliveryStatusEnum,
    Notification,
    NotificationPriorityEnum,
    NotificationTypeEnum,
)
from app.models.notification_delivery_status import NotificationDeliveryStatus
from app.models.notification_preference import NotificationPreference

logger = get_logger(__name__)

# Default expiration offset from event date
NOTIFICATION_EXPIRY_DAYS = 30


class NotificationService:
    """Service for notification lifecycle management."""

    @staticmethod
    async def _get_enabled_channels(
        db: AsyncSession,
        user_id: uuid.UUID,
        notification_type: NotificationTypeEnum,
    ) -> list[DeliveryChannelEnum]:
        """Return channels enabled for a user+type, defaulting to all if no prefs."""
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.notification_type == notification_type,
        )
        result = await db.execute(stmt)
        prefs = list(result.scalars().all())

        if not prefs:
            # No preferences stored → default to in-app only
            return [DeliveryChannelEnum.INAPP]

        return [p.channel for p in prefs if p.enabled]

    @staticmethod
    async def create_notification(
        db: AsyncSession,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        notification_type: NotificationTypeEnum,
        title: str,
        body: str,
        priority: NotificationPriorityEnum = NotificationPriorityEnum.NORMAL,
        data: dict[str, Any] | None = None,
        campaign_id: uuid.UUID | None = None,
        created_by: uuid.UUID | None = None,
        expires_at: datetime | None = None,
        sio: Any | None = None,
        override_channels: list[DeliveryChannelEnum] | None = None,
        dispatch_tasks: bool = True,
    ) -> Notification:
        """Create a notification with per-channel delivery status rows.

        Args:
            db: Async database session
            event_id: Event this notification belongs to
            user_id: Recipient user
            notification_type: Type of notification
            title: Short title (max 200 chars)
            body: Full body text
            priority: Priority level
            data: Optional JSON payload
            campaign_id: Optional link to a campaign
            created_by: Optional admin user who triggered this
            expires_at: Optional explicit expiry; defaults to +30 days
            sio: Optional Socket.IO server for real-time emit
            override_channels: When provided (e.g. from an admin campaign),
                use these channels instead of the user's notification preferences.
            dispatch_tasks: When True (default), dispatch Celery tasks for
                push/email/SMS delivery immediately.  Set to False when the
                caller will commit and dispatch tasks itself (e.g. campaign
                delivery) to avoid transaction-isolation issues with eager
                Celery tasks.

        Returns:
            The created Notification instance.
        """
        if expires_at is None:
            expires_at = datetime.now(UTC) + timedelta(days=NOTIFICATION_EXPIRY_DAYS)

        notification = Notification(
            event_id=event_id,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            priority=priority,
            data=data,
            campaign_id=campaign_id,
            created_by=created_by,
            expires_at=expires_at,
        )
        db.add(notification)
        await db.flush()

        # Use admin-specified channels if provided, otherwise check user prefs
        if override_channels is not None:
            channels = override_channels
        else:
            channels = await NotificationService._get_enabled_channels(
                db, user_id, notification_type
            )

        for channel in channels:
            # INAPP is "delivered" the moment the row exists in the DB
            is_inapp = channel == DeliveryChannelEnum.INAPP
            delivery = NotificationDeliveryStatus(
                notification_id=notification.id,
                channel=channel,
                status=DeliveryStatusEnum.SENT if is_inapp else DeliveryStatusEnum.PENDING,
                sent_at=datetime.now(UTC) if is_inapp else None,
            )
            db.add(delivery)

        await db.flush()

        # Store resolved channels on the notification object so the caller
        # can dispatch delivery tasks after committing (avoids transaction-
        # isolation issues when Celery runs tasks eagerly).
        notification._resolved_channels = channels  # type: ignore[attr-defined]

        # Emit via Socket.IO if available
        if sio is not None:
            room = f"user:{user_id}:event:{event_id}"
            try:
                await sio.emit(
                    "notification:new",
                    {
                        "id": str(notification.id),
                        "notification_type": notification_type.value,
                        "title": title,
                        "body": body,
                        "priority": priority.value,
                        "data": data,
                        "created_at": notification.created_at.isoformat()
                        if notification.created_at
                        else None,
                    },
                    room=room,
                )
            except Exception:
                logger.warning(
                    "Failed to emit Socket.IO notification",
                    extra={"notification_id": str(notification.id), "room": room},
                )

        # Dispatch Celery tasks for delivery channels.
        # When dispatch_tasks=False the caller is responsible for dispatching
        # after it commits the transaction (see dispatch_delivery_tasks).
        if dispatch_tasks:
            NotificationService.dispatch_delivery_tasks(str(notification.id), channels)

        logger.info(
            "Notification created",
            extra={
                "notification_id": str(notification.id),
                "user_id": str(user_id),
                "type": notification_type.value,
                "channels": [c.value for c in channels],
            },
        )

        return notification

    @staticmethod
    def dispatch_delivery_tasks(
        notification_id: str,
        channels: list[DeliveryChannelEnum],
    ) -> None:
        """Dispatch Celery delivery tasks for the given channels.

        Call this AFTER the transaction containing the notification has been
        committed so that the Celery workers (or eager-mode inline execution)
        can see the rows.
        """
        if DeliveryChannelEnum.PUSH in channels:
            try:
                from app.tasks.notification_tasks import send_push_notification_task

                send_push_notification_task.delay(notification_id)
            except Exception:
                logger.warning(
                    "Failed to dispatch push notification task",
                    extra={"notification_id": notification_id},
                )

        if DeliveryChannelEnum.EMAIL in channels:
            try:
                from app.tasks.notification_tasks import send_email_notification_task

                send_email_notification_task.delay(notification_id)
            except Exception:
                logger.warning(
                    "Failed to dispatch email notification task",
                    extra={"notification_id": notification_id},
                )

        if DeliveryChannelEnum.SMS in channels:
            try:
                from app.tasks.notification_tasks import send_sms_notification_task

                send_sms_notification_task.delay(notification_id)
            except Exception:
                logger.warning(
                    "Failed to dispatch SMS notification task",
                    extra={"notification_id": notification_id},
                )

    @staticmethod
    async def list_notifications(
        db: AsyncSession,
        user_id: uuid.UUID,
        event_id: uuid.UUID,
        limit: int = 20,
        cursor: str | None = None,
        unread_only: bool = False,
    ) -> tuple[list[Notification], str | None]:
        """List notifications with cursor-based pagination.

        Args:
            db: Async database session
            user_id: Owner of the notifications
            event_id: Event scope
            limit: Max results (default 20)
            cursor: ISO-format created_at cursor for pagination
            unread_only: If True, only return unread notifications

        Returns:
            Tuple of (notifications list, next_cursor or None).
        """
        stmt = (
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.event_id == event_id,
            )
            .order_by(Notification.created_at.desc())
            .limit(limit + 1)
        )

        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))

        if cursor:
            cursor_dt = datetime.fromisoformat(cursor)
            stmt = stmt.where(Notification.created_at < cursor_dt)

        result = await db.execute(stmt)
        rows = list(result.scalars().all())

        next_cursor: str | None = None
        if len(rows) > limit:
            rows = rows[:limit]
            next_cursor = rows[-1].created_at.isoformat()

        return rows, next_cursor

    @staticmethod
    async def get_unread_count(
        db: AsyncSession,
        user_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> int:
        """Count unread notifications for a user in an event."""
        stmt = select(func.count()).where(
            Notification.user_id == user_id,
            Notification.event_id == event_id,
            Notification.is_read.is_(False),
        )
        result = await db.execute(stmt)
        return result.scalar_one()

    @staticmethod
    async def mark_read(
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Mark a single notification as read.

        Returns True if a row was updated, False if not found or already read.
        """
        now = datetime.now(UTC)
        stmt = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        cursor_result = await db.execute(stmt)
        await db.flush()
        return (cursor_result.rowcount or 0) > 0  # type: ignore[attr-defined]

    @staticmethod
    async def mark_all_read(
        db: AsyncSession,
        user_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> int:
        """Mark all unread notifications as read for a user in an event.

        Returns the number of notifications updated.
        """
        now = datetime.now(UTC)
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.event_id == event_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        cursor_result = await db.execute(stmt)
        await db.flush()
        count: int = cursor_result.rowcount or 0  # type: ignore[attr-defined]
        return count
