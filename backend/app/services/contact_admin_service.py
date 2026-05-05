"""ContactAdminService — donor-to-NPO-admin messaging for checkout support."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.event import Event
from app.models.notification import (
    DeliveryChannelEnum,
    NotificationPriorityEnum,
    NotificationTypeEnum,
)
from app.models.npo_member import MemberRole, NPOMember
from app.models.user import User
from app.services.email_service import get_email_service
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


class ContactAdminService:
    """Send a donor's message to the NPO admin for a given event."""

    @staticmethod
    async def send_message(
        db: AsyncSession,
        event_id: uuid.UUID,
        donor_user_id: uuid.UUID,
        message: str,
    ) -> None:
        """Fire-and-forget: send donor message to NPO admin via email and push.

        Looks up the NPO admin for the event's NPO and sends:
        1. An email via EmailService
        2. A push/in-app notification via NotificationService

        Errors are logged but never raised (fire-and-forget pattern).
        """
        try:
            # Resolve event → npo_id
            event_result = await db.execute(select(Event).where(Event.id == event_id))
            event = event_result.scalar_one_or_none()
            if event is None:
                logger.warning("ContactAdmin: event not found", extra={"event_id": str(event_id)})
                return

            npo_id = event.npo_id

            # Resolve donor info
            donor_result = await db.execute(select(User).where(User.id == donor_user_id))
            donor = donor_result.scalar_one_or_none()
            donor_name = donor.full_name if donor else "A donor"
            donor_email = donor.email if donor else "unknown"

            # Find NPO admin users
            members_result = await db.execute(
                select(NPOMember).where(
                    NPOMember.npo_id == npo_id,
                    NPOMember.role == MemberRole.ADMIN,
                )
            )
            admins = list(members_result.scalars().all())

            if not admins:
                logger.warning(
                    "ContactAdmin: no admin found for NPO",
                    extra={"npo_id": str(npo_id), "event_id": str(event_id)},
                )
                return

            email_svc = get_email_service()

            for admin_member in admins:
                admin_result = await db.execute(select(User).where(User.id == admin_member.user_id))
                admin_user = admin_result.scalar_one_or_none()
                if admin_user is None:
                    continue

                # Send email
                try:
                    await email_svc.send_notification_email(
                        to_email=admin_user.email,
                        notification_type="custom",
                        title=f"Donor message from {donor_name}",
                        body=f"Message from {donor_name} ({donor_email}) at {event.name}:\n\n{message}",
                        donor_name=admin_user.first_name,
                        data={"event_id": str(event_id)},
                    )
                except Exception:
                    logger.warning(
                        "ContactAdmin: email send failed",
                        extra={"admin_user_id": str(admin_member.user_id)},
                        exc_info=True,
                    )

                # Send in-app/push notification
                try:
                    await NotificationService.create_notification(
                        db=db,
                        event_id=event_id,
                        user_id=admin_member.user_id,
                        notification_type=NotificationTypeEnum.CUSTOM,
                        title=f"Donor message: {donor_name}",
                        body=message[:200],
                        priority=NotificationPriorityEnum.HIGH,
                        data={
                            "event_id": str(event_id),
                            "donor_user_id": str(donor_user_id),
                            "action": "donor_contact",
                        },
                        override_channels=[DeliveryChannelEnum.PUSH, DeliveryChannelEnum.INAPP],
                    )
                except Exception:
                    logger.warning(
                        "ContactAdmin: push notification failed",
                        extra={"admin_user_id": str(admin_member.user_id)},
                        exc_info=True,
                    )

        except Exception:
            logger.error(
                "ContactAdmin: unexpected error sending message",
                extra={"event_id": str(event_id), "donor_user_id": str(donor_user_id)},
                exc_info=True,
            )
