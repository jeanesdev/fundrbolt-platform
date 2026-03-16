"""Notification scheduler for auction lifecycle events.

Schedules and sends auction-related notifications (opened, closing soon, closed)
using Celery delayed tasks.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.auction_bid import AuctionBid, BidStatus
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.notification import NotificationPriorityEnum, NotificationTypeEnum
from app.services.notification_service import NotificationService
from app.websocket.notification_ws import sio

logger = get_logger(__name__)

# Task IDs stored for revocation: mapping event_id -> list of celery task IDs
_scheduled_task_ids: dict[str, list[str]] = {}


def schedule_auction_warnings(event_id: str, close_time: datetime) -> list[str]:
    """Schedule Celery tasks for auction closing warnings.

    Schedules notifications at -15min, -5min, and -1min from close_time.

    Args:
        event_id: Event UUID string
        close_time: When the auction closes (timezone-aware)

    Returns:
        List of Celery task IDs for tracking/revocation.
    """
    from app.tasks.notification_tasks import send_auction_closing_soon_task

    now = datetime.now(UTC)
    task_ids: list[str] = []

    for minutes_before in [15, 5, 1]:
        eta = close_time - timedelta(minutes=minutes_before)
        if eta <= now:
            continue

        result = send_auction_closing_soon_task.apply_async(
            args=[event_id, minutes_before],
            eta=eta,
        )
        task_ids.append(result.id)

    _scheduled_task_ids[event_id] = task_ids

    logger.info(
        "Scheduled auction closing warnings",
        extra={"event_id": event_id, "task_count": len(task_ids)},
    )
    return task_ids


def reschedule_auction_warnings(event_id: str, new_close_time: datetime) -> list[str]:
    """Revoke existing warning tasks and schedule new ones.

    Args:
        event_id: Event UUID string
        new_close_time: Updated auction close time

    Returns:
        List of new Celery task IDs.
    """
    from app.celery_app import celery_app

    # Revoke old tasks
    old_task_ids = _scheduled_task_ids.pop(event_id, [])
    for task_id in old_task_ids:
        celery_app.control.revoke(task_id, terminate=False)

    logger.info(
        "Revoked old auction warning tasks",
        extra={"event_id": event_id, "revoked_count": len(old_task_ids)},
    )

    return schedule_auction_warnings(event_id, new_close_time)


async def send_auction_opened_notification(db: AsyncSession, event_id: str) -> int:
    """Send auction-opened notification to all confirmed registrants.

    Args:
        db: Async database session
        event_id: Event UUID string

    Returns:
        Number of notifications sent.
    """
    event_uuid = uuid.UUID(event_id)

    # Get event info for the notification body
    event_result = await db.execute(select(Event.name, Event.slug).where(Event.id == event_uuid))
    event_row = event_result.one_or_none()
    if not event_row:
        logger.warning(
            "Event not found for auction opened notification", extra={"event_id": event_id}
        )
        return 0

    event_name, event_slug = event_row

    # Get all confirmed registrants
    reg_stmt = select(EventRegistration.user_id).where(
        EventRegistration.event_id == event_uuid,
    )
    reg_result = await db.execute(reg_stmt)
    user_ids = [row[0] for row in reg_result.all()]

    sent = 0
    for user_id in user_ids:
        try:
            await NotificationService.create_notification(
                db=db,
                event_id=event_uuid,
                user_id=user_id,
                notification_type=NotificationTypeEnum.AUCTION_OPENED,
                priority=NotificationPriorityEnum.NORMAL,
                title="Auction is now open!",
                body=f"Bidding is live for {event_name}. Browse items and place your bids!",
                data={
                    "deep_link": f"/events/{event_slug}/auction",
                    "animation_type": "pulse",
                },
                sio=sio,
            )
            sent += 1
        except Exception:
            logger.warning(
                "Failed to create auction opened notification",
                extra={"event_id": event_id, "user_id": str(user_id)},
            )

    await db.commit()
    logger.info(
        "Sent auction opened notifications",
        extra={"event_id": event_id, "sent_count": sent, "total_registrants": len(user_ids)},
    )
    return sent


async def send_auction_closing_soon(db: AsyncSession, event_id: str, minutes_remaining: int) -> int:
    """Send closing-soon notification to donors with active bids.

    Args:
        db: Async database session
        event_id: Event UUID string
        minutes_remaining: Minutes until auction close

    Returns:
        Number of notifications sent.
    """
    event_uuid = uuid.UUID(event_id)

    # Get event info
    event_result = await db.execute(select(Event.name, Event.slug).where(Event.id == event_uuid))
    event_row = event_result.one_or_none()
    if not event_row:
        return 0

    event_name, event_slug = event_row

    # Find users with active bids in this event
    active_bidders_stmt = (
        select(AuctionBid.user_id)
        .where(
            AuctionBid.event_id == event_uuid,
            AuctionBid.bid_status == BidStatus.ACTIVE.value,
        )
        .distinct()
    )
    result = await db.execute(active_bidders_stmt)
    user_ids = [row[0] for row in result.all()]

    sent = 0
    for user_id in user_ids:
        try:
            await NotificationService.create_notification(
                db=db,
                event_id=event_uuid,
                user_id=user_id,
                notification_type=NotificationTypeEnum.AUCTION_CLOSING_SOON,
                priority=NotificationPriorityEnum.HIGH,
                title=f"Auction closing in {minutes_remaining} min!",
                body=(
                    f"The auction for {event_name} closes in {minutes_remaining} "
                    f"{'minute' if minutes_remaining == 1 else 'minutes'}. "
                    "Review your bids now!"
                ),
                data={
                    "deep_link": f"/events/{event_slug}/auction",
                    "minutes_remaining": minutes_remaining,
                },
                sio=sio,
            )
            sent += 1
        except Exception:
            logger.warning(
                "Failed to create closing soon notification",
                extra={"event_id": event_id, "user_id": str(user_id)},
            )

    await db.commit()
    logger.info(
        "Sent auction closing soon notifications",
        extra={
            "event_id": event_id,
            "minutes_remaining": minutes_remaining,
            "sent_count": sent,
        },
    )
    return sent


# ---------------------------------------------------------------------------
# T051: Checkout reminder scheduling
# ---------------------------------------------------------------------------


def schedule_checkout_reminders(
    event_id: str,
    initial_delay_minutes: int = 0,
    followup_interval_minutes: int = 30,
    max_reminders: int = 3,
) -> list[str]:
    """Schedule checkout reminder tasks (initial + follow-ups).

    Args:
        event_id: Event UUID string
        initial_delay_minutes: Delay before first reminder (0 = immediate)
        followup_interval_minutes: Interval between follow-up reminders
        max_reminders: Maximum number of reminders (default 3)

    Returns:
        List of Celery task IDs for tracking.
    """
    from app.tasks.notification_tasks import send_checkout_reminders_task

    now = datetime.now(UTC)
    task_ids: list[str] = []

    for i in range(max_reminders):
        delay = initial_delay_minutes + (i * followup_interval_minutes)
        eta = now + timedelta(minutes=delay)

        result = send_checkout_reminders_task.apply_async(
            args=[event_id],
            eta=eta,
        )
        task_ids.append(result.id)

    logger.info(
        "Scheduled checkout reminders",
        extra={
            "event_id": event_id,
            "count": len(task_ids),
            "initial_delay_minutes": initial_delay_minutes,
            "followup_interval_minutes": followup_interval_minutes,
        },
    )
    return task_ids
