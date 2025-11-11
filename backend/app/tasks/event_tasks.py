"""Event-related background tasks.

NOTE: Celery is not yet configured in this project. These are placeholder
functions that should be converted to Celery tasks when Celery is set up.

To set up Celery:
1. Add celery to pyproject.toml dependencies
2. Create app/celery_app.py with Celery configuration
3. Add @celery_app.task decorator to these functions
4. Configure celery beat for periodic tasks
"""

import logging
from datetime import datetime, timedelta

import pytz
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import EVENTS_CLOSED_TOTAL
from app.models.event import Event, EventStatus

logger = logging.getLogger(__name__)


async def close_expired_events_task(db: AsyncSession) -> int:
    """
    Background task: Close events 24 hours after event_datetime.

    This should be run as a periodic Celery task (e.g., every 15 minutes).

    Args:
        db: Database session

    Returns:
        Number of events closed
    """
    cutoff_time = datetime.now(pytz.UTC) - timedelta(hours=24)

    query = select(Event).where(
        and_(Event.status == EventStatus.ACTIVE, Event.event_datetime < cutoff_time)
    )

    result = await db.execute(query)
    events_to_close = list(result.scalars().all())

    for event in events_to_close:
        event.status = EventStatus.CLOSED
        event.version += 1

    if events_to_close:
        await db.commit()
        EVENTS_CLOSED_TOTAL.labels(closure_type="automatic").inc(len(events_to_close))
        logger.info(f"Auto-closed {len(events_to_close)} expired events")

    return len(events_to_close)


async def scan_uploaded_file_task(media_id: str) -> dict[str, bool | str]:
    """
    Background task: Scan uploaded file for viruses using ClamAV.

    This should be run as an async Celery task triggered after file upload.

    Args:
        media_id: UUID of the EventMedia record

    Returns:
        dict with scan results: {"passed": bool, "details": str}

    Implementation notes:
    - Install ClamAV: apt-get install clamav clamav-daemon
    - Use python-clamav or pyclamd library
    - Update virus definitions: freshclam
    - Scan file from Azure Blob Storage
    - Update EventMedia status based on scan result
    - Delete file from blob storage if infected
    """
    # TODO: Implement ClamAV integration
    # from app.services.media_service import MediaService
    # import pyclamd
    #
    # Example implementation:
    # 1. Download file from Azure Blob to temp location
    # 2. Scan with ClamAV: cd = pyclamd.ClamdUnixSocket()
    #                      scan_result = cd.scan_file(temp_file_path)
    # 3. Update media status: await MediaService.mark_scan_complete(db, media_id, passed, details)
    # 4. Delete temp file
    # 5. If infected, delete from blob storage

    logger.warning(f"Virus scanning not yet implemented for media {media_id}")
    return {"passed": True, "details": "Scan not implemented - auto-approved"}


# Celery configuration example (when Celery is set up):
#
# from app.celery_app import celery_app
#
# @celery_app.task(name="event_tasks.close_expired_events")
# def close_expired_events():
#     """Celery task wrapper for close_expired_events_task."""
#     from app.core.database import get_async_session
#     async with get_async_session() as db:
#         return await close_expired_events_task(db)
#
# @celery_app.task(name="event_tasks.scan_uploaded_file")
# def scan_uploaded_file(media_id: str):
#     """Celery task wrapper for scan_uploaded_file_task."""
#     from app.core.database import get_async_session
#     async with get_async_session() as db:
#         return await scan_uploaded_file_task(media_id)
#
# Celery Beat schedule:
# celery_app.conf.beat_schedule = {
#     "close-expired-events-every-15-minutes": {
#         "task": "event_tasks.close_expired_events",
#         "schedule": 900.0,  # 15 minutes in seconds
#     },
# }
