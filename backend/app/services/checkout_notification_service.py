"""CheckoutNotificationService — send checkout link and reminder notifications."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.checkout_session import CheckoutSession, CheckoutStatusEnum
from app.models.event_registration import EventRegistration
from app.models.notification import (
    DeliveryChannelEnum,
    NotificationPriorityEnum,
    NotificationTypeEnum,
)
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


class CheckoutNotificationService:
    """Send checkout link and reminder notifications to donors."""

    @staticmethod
    async def send_checkout_link(
        db: AsyncSession,
        event_id: uuid.UUID,
        user_ids: list[uuid.UUID] | None = None,
    ) -> int:
        """Send checkout link notification to all or selected donors.

        If user_ids is None, sends to all registered donors for the event.
        Returns the count of notifications dispatched.
        """
        targets = await CheckoutNotificationService._resolve_targets(
            db, event_id, user_ids, filter_incomplete=False
        )

        count = 0
        for user_id in targets:
            try:
                await NotificationService.create_notification(
                    db=db,
                    event_id=event_id,
                    user_id=user_id,
                    notification_type=NotificationTypeEnum.CUSTOM,
                    title="Your checkout is ready",
                    body="Your checkout is now open. Tap to review your balance and complete payment.",
                    priority=NotificationPriorityEnum.HIGH,
                    data={"event_id": str(event_id), "action": "checkout_link"},
                    override_channels=[DeliveryChannelEnum.PUSH, DeliveryChannelEnum.INAPP],
                )
                count += 1
            except Exception:
                logger.warning(
                    "Failed to send checkout link notification",
                    extra={"user_id": str(user_id), "event_id": str(event_id)},
                    exc_info=True,
                )

        return count

    @staticmethod
    async def send_checkout_reminder(
        db: AsyncSession,
        event_id: uuid.UUID,
        user_ids: list[uuid.UUID] | None = None,
    ) -> int:
        """Send reminder to donors who have not yet completed checkout.

        If user_ids is None, sends to all donors whose session status != 'complete'.
        Returns the count of notifications dispatched.
        """
        targets = await CheckoutNotificationService._resolve_targets(
            db, event_id, user_ids, filter_incomplete=True
        )

        count = 0
        for user_id in targets:
            try:
                await NotificationService.create_notification(
                    db=db,
                    event_id=event_id,
                    user_id=user_id,
                    notification_type=NotificationTypeEnum.CHECKOUT_REMINDER,
                    title="Reminder: Complete your checkout",
                    body="You still have an outstanding balance. Please complete your checkout.",
                    priority=NotificationPriorityEnum.HIGH,
                    data={"event_id": str(event_id), "action": "checkout_reminder"},
                    override_channels=[DeliveryChannelEnum.PUSH, DeliveryChannelEnum.INAPP],
                )
                count += 1
            except Exception:
                logger.warning(
                    "Failed to send checkout reminder notification",
                    extra={"user_id": str(user_id), "event_id": str(event_id)},
                    exc_info=True,
                )

        return count

    @staticmethod
    async def _resolve_targets(
        db: AsyncSession,
        event_id: uuid.UUID,
        user_ids: list[uuid.UUID] | None,
        filter_incomplete: bool,
    ) -> list[uuid.UUID]:
        """Resolve target user IDs for the notification.

        If user_ids is provided, use them directly (optionally filtering to incomplete).
        Otherwise, derive from event registrations (and optionally filter incomplete).
        """
        if user_ids is not None:
            if not filter_incomplete:
                return user_ids
            # Filter to only incomplete sessions
            incomplete = await CheckoutNotificationService._get_incomplete_user_ids(db, event_id)
            incomplete_set = set(incomplete)
            return [uid for uid in user_ids if uid in incomplete_set]

        if filter_incomplete:
            return await CheckoutNotificationService._get_incomplete_user_ids(db, event_id)

        # All registered donors for event
        result = await db.execute(
            select(EventRegistration.user_id).where(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id.isnot(None),
            )
        )
        return [row[0] for row in result.all() if row[0] is not None]

    @staticmethod
    async def _get_incomplete_user_ids(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> list[uuid.UUID]:
        """Return user IDs with non-complete checkout sessions for the event."""
        result = await db.execute(
            select(CheckoutSession.user_id).where(
                CheckoutSession.event_id == event_id,
                CheckoutSession.status != CheckoutStatusEnum.COMPLETE,
            )
        )
        return [row[0] for row in result.all()]
