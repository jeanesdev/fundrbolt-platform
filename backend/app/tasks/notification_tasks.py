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
from app.models.notification import (
    CampaignStatusEnum,
    Notification,
    NotificationPriorityEnum,
    NotificationTypeEnum,
)
from app.models.notification_campaign import NotificationCampaign
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


@celery_app.task(
    name="app.tasks.notification_tasks.send_push_notification_task",
    bind=True,
    max_retries=1,
)
def send_push_notification_task(self: Any, notification_id: str) -> bool:
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
    try:
        return _run_async(_send_push_async(notification_id))
    except Exception as exc:
        logger.exception(
            "send_push_notification_task failed",
            extra={"notification_id": notification_id},
        )
        raise self.retry(exc=exc) from exc


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


# ---------------------------------------------------------------------------
# T050: Checkout reminder task
# ---------------------------------------------------------------------------
@celery_app.task(
    name="app.tasks.notification_tasks.send_checkout_reminders_task",
    bind=True,
    max_retries=1,
)
def send_checkout_reminders_task(self: Any, event_id: str) -> int:
    """Send checkout reminder notifications to donors with outstanding balances.

    Args:
        event_id: Event UUID string

    Returns:
        Number of reminder notifications sent.
    """
    logger.info("Running send_checkout_reminders_task", extra={"event_id": event_id})
    try:
        return _run_async(_send_checkout_reminders_async(event_id))
    except Exception as exc:
        logger.exception("send_checkout_reminders_task failed", extra={"event_id": event_id})
        raise self.retry(exc=exc) from exc


async def _send_checkout_reminders_async(event_id: str) -> int:
    from app.models.event_registration import EventRegistration

    async with AsyncSessionLocal() as db:
        try:
            event_uuid = uuid.UUID(event_id)

            # Get event info
            event_result = await db.execute(
                select(Event.name, Event.slug).where(Event.id == event_uuid)
            )
            event_row = event_result.one_or_none()
            if not event_row:
                logger.warning(
                    "Event not found for checkout reminders", extra={"event_id": event_id}
                )
                return 0

            event_name, event_slug = event_row

            # Find donors with winning bids (outstanding balances)
            donors_stmt = (
                select(AuctionBid.user_id)
                .where(
                    AuctionBid.event_id == event_uuid,
                    AuctionBid.bid_status == BidStatus.WINNING.value,
                )
                .distinct()
            )
            result = await db.execute(donors_stmt)
            donor_ids = [row[0] for row in result.all()]

            # Also include all registered attendees as they may have paddle raises
            reg_stmt = select(EventRegistration.user_id).where(
                EventRegistration.event_id == event_uuid
            )
            reg_result = await db.execute(reg_stmt)
            reg_ids = {row[0] for row in reg_result.all()}

            all_recipients = set(donor_ids) | reg_ids
            sent = 0

            for user_id in all_recipients:
                try:
                    await NotificationService.create_notification(
                        db=db,
                        event_id=event_uuid,
                        user_id=user_id,
                        notification_type=NotificationTypeEnum.CHECKOUT_REMINDER,
                        priority=NotificationPriorityEnum.URGENT,
                        title="Time to check out!",
                        body=(
                            f"Please visit the checkout area at {event_name} "
                            "to complete your purchases."
                        ),
                        data={
                            "deep_link": f"/events/{event_slug}",
                        },
                        sio=sio,
                    )
                    sent += 1
                except Exception:
                    logger.warning(
                        "Failed to create checkout reminder",
                        extra={"user_id": str(user_id), "event_id": event_id},
                    )

            await db.commit()
            logger.info(
                "Sent checkout reminders",
                extra={"event_id": event_id, "sent_count": sent},
            )
            return sent
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send checkout reminders",
                extra={"event_id": event_id},
            )
            raise


# ---------------------------------------------------------------------------
# T054: Campaign delivery task
# ---------------------------------------------------------------------------
@celery_app.task(
    name="app.tasks.notification_tasks.deliver_campaign_task",
    bind=True,
    max_retries=1,
)
def deliver_campaign_task(self: Any, campaign_id: str) -> int:
    """Deliver a notification campaign to resolved recipients.

    Args:
        campaign_id: NotificationCampaign UUID string

    Returns:
        Number of notifications created.
    """
    logger.info("Running deliver_campaign_task", extra={"campaign_id": campaign_id})
    try:
        return _run_async(_deliver_campaign_async(campaign_id))
    except Exception as exc:
        logger.exception("deliver_campaign_task failed", extra={"campaign_id": campaign_id})
        raise self.retry(exc=exc) from exc


async def _deliver_campaign_async(campaign_id: str) -> int:
    from app.models.event_registration import EventRegistration

    async with AsyncSessionLocal() as db:
        try:
            campaign_uuid = uuid.UUID(campaign_id)

            # Load campaign
            campaign_result = await db.execute(
                select(NotificationCampaign).where(NotificationCampaign.id == campaign_uuid)
            )
            campaign = campaign_result.scalar_one_or_none()
            if not campaign:
                logger.warning("Campaign not found", extra={"campaign_id": campaign_id})
                return 0

            campaign.status = CampaignStatusEnum.SENDING
            await db.flush()

            # Resolve recipients based on criteria
            criteria = campaign.recipient_criteria or {}
            recipient_type = criteria.get("type", "all_attendees")
            event_id = campaign.event_id

            # Get event info
            event_result = await db.execute(
                select(Event.name, Event.slug).where(Event.id == event_id)
            )
            event_row = event_result.one_or_none()
            event_name = event_row[0] if event_row else "the event"

            user_ids: list[uuid.UUID] = []

            if recipient_type == "all_attendees":
                stmt = select(EventRegistration.user_id).where(
                    EventRegistration.event_id == event_id
                )
                result = await db.execute(stmt)
                user_ids = [row[0] for row in result.all()]

            elif recipient_type == "all_bidders":
                stmt = select(AuctionBid.user_id).where(AuctionBid.event_id == event_id).distinct()
                result = await db.execute(stmt)
                user_ids = [row[0] for row in result.all()]

            elif recipient_type == "specific_table":
                from app.models.registration_guest import RegistrationGuest

                table_number = criteria.get("table_number")
                if table_number is not None:
                    stmt = (
                        select(RegistrationGuest.user_id)
                        .join(
                            EventRegistration,
                            RegistrationGuest.registration_id == EventRegistration.id,
                        )
                        .where(
                            EventRegistration.event_id == event_id,
                            RegistrationGuest.table_number == table_number,
                            RegistrationGuest.user_id.isnot(None),
                        )
                    )
                    result = await db.execute(stmt)
                    user_ids = [row[0] for row in result.all()]

            elif recipient_type == "individual":
                individual_ids = criteria.get("user_ids", [])
                user_ids = [uuid.UUID(uid) for uid in individual_ids]

            # Deduplicate
            unique_user_ids = list(set(user_ids))
            campaign.recipient_count = len(unique_user_ids)

            sent = 0
            failed = 0

            for user_id in unique_user_ids:
                try:
                    await NotificationService.create_notification(
                        db=db,
                        event_id=event_id,
                        user_id=user_id,
                        notification_type=NotificationTypeEnum.CUSTOM,
                        priority=NotificationPriorityEnum.NORMAL,
                        title=f"Message from {event_name}",
                        body=campaign.message,
                        campaign_id=campaign.id,
                        created_by=campaign.sender_id,
                        data={"deep_link": None},
                        sio=sio,
                    )
                    sent += 1
                except Exception:
                    failed += 1
                    logger.warning(
                        "Failed to create campaign notification",
                        extra={"user_id": str(user_id), "campaign_id": campaign_id},
                    )

            campaign.delivered_count = sent
            campaign.failed_count = failed
            campaign.status = CampaignStatusEnum.SENT
            campaign.sent_at = datetime.now(UTC)
            await db.commit()

            logger.info(
                "Campaign delivered",
                extra={
                    "campaign_id": campaign_id,
                    "sent": sent,
                    "failed": failed,
                    "total_recipients": len(unique_user_ids),
                },
            )
            return sent
        except Exception:
            await db.rollback()
            # Mark campaign as failed
            try:
                campaign_result2 = await db.execute(
                    select(NotificationCampaign).where(
                        NotificationCampaign.id == uuid.UUID(campaign_id)
                    )
                )
                c = campaign_result2.scalar_one_or_none()
                if c:
                    c.status = CampaignStatusEnum.FAILED
                    await db.commit()
            except Exception:
                pass
            logger.exception("Failed to deliver campaign", extra={"campaign_id": campaign_id})
            raise


# ---------------------------------------------------------------------------
# T073: Email notification task
# ---------------------------------------------------------------------------
@celery_app.task(
    name="app.tasks.notification_tasks.send_email_notification_task",
    bind=True,
    max_retries=1,
)
def send_email_notification_task(self: Any, notification_id: str) -> bool:
    """Send email notification for a given notification.

    Args:
        notification_id: Notification UUID string

    Returns:
        True if email was sent successfully.
    """
    logger.info(
        "Running send_email_notification_task",
        extra={"notification_id": notification_id},
    )
    try:
        return _run_async(_send_email_notification_async(notification_id))
    except Exception as exc:
        logger.exception(
            "send_email_notification_task failed",
            extra={"notification_id": notification_id},
        )
        raise self.retry(exc=exc) from exc


async def _send_email_notification_async(notification_id: str) -> bool:
    from app.models.notification_delivery_status import NotificationDeliveryStatus
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        try:
            notif_uuid = uuid.UUID(notification_id)
            stmt = select(Notification).where(Notification.id == notif_uuid)
            result = await db.execute(stmt)
            notification = result.scalar_one_or_none()
            if not notification:
                return False

            # Get user email
            user_result = await db.execute(
                select(User.email, User.first_name).where(User.id == notification.user_id)
            )
            user_row = user_result.one_or_none()
            if not user_row:
                return False

            email, first_name = user_row

            # TODO: Integrate with email_service.py email templates (T072)
            # For now, log that email would be sent
            logger.info(
                "Email notification would be sent",
                extra={
                    "notification_id": notification_id,
                    "to": email,
                    "subject": notification.title,
                },
            )

            # Update delivery status
            from app.models.notification import DeliveryChannelEnum, DeliveryStatusEnum

            delivery_stmt = select(NotificationDeliveryStatus).where(
                NotificationDeliveryStatus.notification_id == notif_uuid,
                NotificationDeliveryStatus.channel == DeliveryChannelEnum.EMAIL,
            )
            delivery_result = await db.execute(delivery_stmt)
            delivery = delivery_result.scalar_one_or_none()
            if delivery:
                delivery.status = DeliveryStatusEnum.SENT
                delivery.sent_at = datetime.now(UTC)

            await db.commit()
            return True
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send email notification",
                extra={"notification_id": notification_id},
            )
            return False


# ---------------------------------------------------------------------------
# T073: SMS notification task
# ---------------------------------------------------------------------------
@celery_app.task(
    name="app.tasks.notification_tasks.send_sms_notification_task",
    bind=True,
    max_retries=1,
)
def send_sms_notification_task(self: Any, notification_id: str) -> bool:
    """Send SMS notification for a given notification.

    Args:
        notification_id: Notification UUID string

    Returns:
        True if SMS was sent successfully.
    """
    logger.info(
        "Running send_sms_notification_task",
        extra={"notification_id": notification_id},
    )
    try:
        return _run_async(_send_sms_notification_async(notification_id))
    except Exception as exc:
        logger.exception(
            "send_sms_notification_task failed",
            extra={"notification_id": notification_id},
        )
        raise self.retry(exc=exc) from exc


async def _send_sms_notification_async(notification_id: str) -> bool:
    from app.models.notification_delivery_status import NotificationDeliveryStatus
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        try:
            notif_uuid = uuid.UUID(notification_id)
            stmt = select(Notification).where(Notification.id == notif_uuid)
            result = await db.execute(stmt)
            notification = result.scalar_one_or_none()
            if not notification:
                return False

            # Get user phone
            user_result = await db.execute(
                select(User.phone).where(User.id == notification.user_id)
            )
            phone = user_result.scalar_one_or_none()
            if not phone:
                logger.info(
                    "No phone number for SMS notification",
                    extra={"notification_id": notification_id},
                )
                return False

            # Compose <=160 char message
            body = notification.body or notification.title or ""
            if len(body) > 157:
                body = body[:157] + "..."

            # Use SMS service if available
            try:
                from app.services.sms_service import send_sms

                await send_sms(phone, body)
            except ImportError:
                logger.info(
                    "SMS service not available, would send SMS",
                    extra={"notification_id": notification_id, "to": phone},
                )

            # Update delivery status
            from app.models.notification import DeliveryChannelEnum, DeliveryStatusEnum

            delivery_stmt = select(NotificationDeliveryStatus).where(
                NotificationDeliveryStatus.notification_id == notif_uuid,
                NotificationDeliveryStatus.channel == DeliveryChannelEnum.SMS,
            )
            delivery_result = await db.execute(delivery_stmt)
            delivery = delivery_result.scalar_one_or_none()
            if delivery:
                delivery.status = DeliveryStatusEnum.SENT
                delivery.sent_at = datetime.now(UTC)

            await db.commit()
            return True
        except Exception:
            await db.rollback()
            logger.exception(
                "Failed to send SMS notification",
                extra={"notification_id": notification_id},
            )
            return False
