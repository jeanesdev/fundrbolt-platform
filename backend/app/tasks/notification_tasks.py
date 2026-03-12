"""Celery tasks for notification delivery and lifecycle.

All tasks run in the 'notifications' queue (configured in celery_app.py).
"""

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select

from app.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.models.auction_bid import AuctionBid, BidStatus
from app.models.event import Event
from app.models.notification import Notification, NotificationPriorityEnum, NotificationTypeEnum
from app.services.notification_scheduler import (
    send_auction_closing_soon,
    send_auction_opened_notification,
)
from app.services.notification_service import NotificationService
from app.websocket.notification_ws import sio

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


@celery_app.task(name="app.tasks.notification_tasks.send_auction_opened_task")
def send_auction_opened_task(event_id: str) -> int:
    """Send auction-opened notifications to all registered donors.

    Args:
        event_id: Event UUID string

    Returns:
        Number of notifications sent.
    """
    logger.info("Running send_auction_opened_task", extra={"event_id": event_id})
    return _run_async(_send_auction_opened_async(event_id))


async def _send_auction_opened_async(event_id: str) -> int:
    async with AsyncSessionLocal() as db:
        try:
            result = await send_auction_opened_notification(db, event_id)
            return result
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send auction opened notifications",
                extra={"event_id": event_id},
            )
            raise


@celery_app.task(name="app.tasks.notification_tasks.send_auction_closing_soon_task")
def send_auction_closing_soon_task(event_id: str, minutes: int) -> int:
    """Send auction-closing-soon notifications to active bidders.

    Args:
        event_id: Event UUID string
        minutes: Minutes remaining until close

    Returns:
        Number of notifications sent.
    """
    logger.info(
        "Running send_auction_closing_soon_task",
        extra={"event_id": event_id, "minutes": minutes},
    )
    return _run_async(_send_auction_closing_soon_async(event_id, minutes))


async def _send_auction_closing_soon_async(event_id: str, minutes: int) -> int:
    async with AsyncSessionLocal() as db:
        try:
            result = await send_auction_closing_soon(db, event_id, minutes)
            return result
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send auction closing soon notifications",
                extra={"event_id": event_id, "minutes": minutes},
            )
            raise


@celery_app.task(name="app.tasks.notification_tasks.send_auction_closed_task")
def send_auction_closed_task(event_id: str) -> int:
    """Determine winners and losers, send appropriate notifications.

    Winners receive ITEM_WON with confetti animation.
    Non-winners who participated receive a thank-you notification.

    Args:
        event_id: Event UUID string

    Returns:
        Total notifications sent.
    """
    logger.info("Running send_auction_closed_task", extra={"event_id": event_id})
    return _run_async(_send_auction_closed_async(event_id))


async def _send_auction_closed_async(event_id: str) -> int:
    async with AsyncSessionLocal() as db:
        try:
            event_uuid = uuid.UUID(event_id)

            # Get event info
            event_result = await db.execute(
                select(Event.name, Event.slug).where(Event.id == event_uuid)
            )
            event_row = event_result.one_or_none()
            if not event_row:
                logger.warning("Event not found for auction closed", extra={"event_id": event_id})
                return 0

            event_name, event_slug = event_row

            # Find all winning bids
            winning_bids_stmt = select(AuctionBid).where(
                AuctionBid.event_id == event_uuid,
                AuctionBid.bid_status == BidStatus.WINNING.value,
            )
            winning_result = await db.execute(winning_bids_stmt)
            winning_bids = list(winning_result.scalars().all())

            winner_user_ids: set[uuid.UUID] = set()
            sent = 0

            # Notify winners
            for bid in winning_bids:
                winner_user_ids.add(bid.user_id)
                try:
                    await NotificationService.create_notification(
                        db=db,
                        event_id=event_uuid,
                        user_id=bid.user_id,
                        notification_type=NotificationTypeEnum.ITEM_WON,
                        priority=NotificationPriorityEnum.HIGH,
                        title="Congratulations! You won! 🎉",
                        body=(
                            f"You won an auction item at {event_name} "
                            f"with a bid of ${bid.bid_amount:,.2f}!"
                        ),
                        data={
                            "item_id": str(bid.auction_item_id),
                            "deep_link": f"/events/{event_slug}/auction/{bid.auction_item_id}",
                            "animation_type": "confetti",
                            "bid_amount": str(bid.bid_amount),
                        },
                        sio=sio,
                    )
                    sent += 1
                except Exception:
                    logger.warning(
                        "Failed to create item won notification",
                        extra={"user_id": str(bid.user_id), "bid_id": str(bid.id)},
                    )

            # Find all participants who didn't win
            all_bidders_stmt = (
                select(AuctionBid.user_id).where(AuctionBid.event_id == event_uuid).distinct()
            )
            all_result = await db.execute(all_bidders_stmt)
            all_bidder_ids = {row[0] for row in all_result.all()}
            non_winners = all_bidder_ids - winner_user_ids

            # Notify non-winners
            for user_id in non_winners:
                try:
                    await NotificationService.create_notification(
                        db=db,
                        event_id=event_uuid,
                        user_id=user_id,
                        notification_type=NotificationTypeEnum.AUCTION_CLOSED,
                        priority=NotificationPriorityEnum.NORMAL,
                        title="Auction has ended",
                        body=(
                            f"Thank you for participating in the {event_name} auction! "
                            "Your support makes a difference."
                        ),
                        data={
                            "deep_link": f"/events/{event_slug}/auction",
                        },
                        sio=sio,
                    )
                    sent += 1
                except Exception:
                    logger.warning(
                        "Failed to create auction closed notification",
                        extra={"user_id": str(user_id)},
                    )

            await db.commit()
            logger.info(
                "Sent auction closed notifications",
                extra={
                    "event_id": event_id,
                    "winners": len(winner_user_ids),
                    "non_winners": len(non_winners),
                    "total_sent": sent,
                },
            )
            return sent
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send auction closed notifications",
                extra={"event_id": event_id},
            )
            raise


@celery_app.task(name="app.tasks.notification_tasks.purge_expired_notifications")
def purge_expired_notifications() -> int:
    """Delete expired notifications (daily scheduled task).

    Returns:
        Number of notifications purged.
    """
    logger.info("Running purge_expired_notifications")
    return _run_async(_purge_expired_async())


async def _purge_expired_async() -> int:
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.now(UTC)
            stmt = delete(Notification).where(
                Notification.expires_at.isnot(None),
                Notification.expires_at < now,
            )
            result = await db.execute(stmt)
            await db.commit()
            count = result.rowcount or 0
            logger.info("Purged expired notifications", extra={"count": count})
            return count
        except Exception:
            await db.rollback()
            logger.exception("Failed to purge expired notifications")
            raise


@celery_app.task(name="app.tasks.notification_tasks.send_push_notification_task")
def send_push_notification_task(notification_id: str) -> bool:
    """Send push notification for a given notification.

    Args:
        notification_id: Notification UUID string

    Returns:
        True if at least one push was sent successfully.
    """
    logger.info(
        "Running send_push_notification_task",
        extra={"notification_id": notification_id},
    )
    return _run_async(_send_push_async(notification_id))


async def _send_push_async(notification_id: str) -> bool:
    from app.services.push_notification_service import PushNotificationService

    async with AsyncSessionLocal() as db:
        try:
            result = await PushNotificationService.send_push(db, uuid.UUID(notification_id))
            return result
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send push notification",
                extra={"notification_id": notification_id},
            )
            return False
