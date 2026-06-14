"""Celery tasks for Revenue Nudge background scanning and notification dispatch."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, insert, select

from app.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.models.event import Event, EventStatus
from app.models.event_nudge_notification_log import EventNudgeNotificationLog
from app.models.notification import NotificationPriorityEnum, NotificationTypeEnum
from app.schemas.nudge import NudgeItem

logger = get_logger(__name__)


@celery_app.task(  # type: ignore[misc]
    name="app.tasks.nudge_tasks.nudge_scan_task", bind=True, max_retries=2
)
def nudge_scan_task(self: Any, event_id: str) -> dict[str, Any]:
    """Compute nudges for one active event and dispatch notifications for new rank 1/2 nudges."""
    try:
        return asyncio.run(_scan_event(event_id))
    except Exception as exc:
        logger.error("nudge_scan_task failed for event %s: %s", event_id, exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc


@celery_app.task(  # type: ignore[misc]
    name="app.tasks.nudge_tasks.fan_out_nudge_scans_task"
)
def fan_out_nudge_scans_task() -> dict[str, Any]:
    """Query all ACTIVE events and dispatch a nudge_scan_task for each."""
    return asyncio.run(_fan_out())


async def _fan_out() -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Event.id).where(Event.status == EventStatus.ACTIVE))
        event_ids = [str(row[0]) for row in result.fetchall()]

    for eid in event_ids:
        nudge_scan_task.delay(eid)

    logger.info("fan_out_nudge_scans: dispatched %d event scan tasks", len(event_ids))
    return {"dispatched": len(event_ids)}


async def _scan_event(event_id_str: str) -> dict[str, Any]:
    event_id = uuid.UUID(event_id_str)

    async with AsyncSessionLocal() as db:
        from app.services.nudge_service import NudgeService

        service = NudgeService(db)
        all_nudges = await service.compute_all_nudges(event_id)

        notifying_nudges = {n.nudge_key: n for n in all_nudges if n.notifies_on_appear}

        result = await db.execute(
            select(EventNudgeNotificationLog.nudge_key).where(
                EventNudgeNotificationLog.event_id == event_id
            )
        )
        already_logged = {row[0] for row in result.fetchall()}

        new_keys = set(notifying_nudges.keys()) - already_logged
        resolved_keys = already_logged - set(notifying_nudges.keys())

        if resolved_keys:
            await db.execute(
                delete(EventNudgeNotificationLog).where(
                    EventNudgeNotificationLog.event_id == event_id,
                    EventNudgeNotificationLog.nudge_key.in_(resolved_keys),
                )
            )

        new_count = 0
        for key in new_keys:
            nudge = notifying_nudges[key]
            now = datetime.now(UTC)
            try:
                await db.execute(
                    insert(EventNudgeNotificationLog).values(
                        id=uuid.uuid4(),
                        event_id=event_id,
                        nudge_key=key,
                        notified_at=now,
                        created_at=now,
                    )
                )
                await _dispatch_notifications(db, event_id, nudge)
                new_count += 1
            except Exception as exc:
                logger.warning("Failed to dispatch nudge notification %s: %s", key, exc)

        await db.commit()

    return {
        "event_id": event_id_str,
        "new_nudges": new_count,
        "resolved": len(resolved_keys),
    }


async def _dispatch_notifications(
    db: Any,
    event_id: uuid.UUID,
    nudge: NudgeItem,
) -> None:
    """Send in-app notification to all NPO Admins and Auctioneers for this event."""
    from app.models.auctioneer import AuctioneerEventSettings
    from app.models.event import Event
    from app.models.npo_member import MemberRole, MemberStatus, NPOMember
    from app.services.notification_service import NotificationService

    event_result = await db.execute(select(Event.npo_id).where(Event.id == event_id))
    npo_id = event_result.scalar_one_or_none()
    if not npo_id:
        return

    # Find active admin members for this NPO
    admin_result = await db.execute(
        select(NPOMember.user_id).where(
            NPOMember.npo_id == npo_id,
            NPOMember.role == MemberRole.ADMIN,
            NPOMember.status == MemberStatus.ACTIVE,
        )
    )
    target_user_ids = {row[0] for row in admin_result.fetchall()}

    # Auctioneers registered for this event
    auc_result = await db.execute(
        select(AuctioneerEventSettings.auctioneer_user_id).where(
            AuctioneerEventSettings.event_id == event_id
        )
    )
    target_user_ids.update(row[0] for row in auc_result.fetchall())

    if not target_user_ids:
        return

    priority = NotificationPriorityEnum.HIGH if nudge.rank == 1 else NotificationPriorityEnum.NORMAL
    for user_id in target_user_ids:
        try:
            await NotificationService.create_notification(
                db=db,
                user_id=user_id,
                event_id=event_id,
                notification_type=NotificationTypeEnum.NUDGE_ALERT,
                title=f"\u26a1 Revenue Nudge: {nudge.title}",
                body=nudge.description,
                data={
                    "event_id": str(event_id),
                    "nudge_key": nudge.nudge_key,
                    "action": "open_nudges_panel",
                },
                priority=priority,
            )
        except Exception as exc:
            logger.warning(
                "Failed to notify user %s for nudge %s: %s", user_id, nudge.nudge_key, exc
            )
