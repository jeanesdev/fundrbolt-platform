"""Background cleanup tasks for onboarding sessions.

NOTE: Celery is not yet configured in this project. These are placeholder
functions intended to be called from a scheduled job (e.g., a cron endpoint,
Celery beat, or Azure Functions timer trigger).

To integrate with Celery:
1. Add @celery_app.task decorator
2. Configure celery beat to run expire_stale_onboarding_sessions every hour
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.onboarding_service import OnboardingService

logger = logging.getLogger(__name__)


async def expire_stale_onboarding_sessions(db: AsyncSession) -> int:
    """Delete onboarding sessions that have passed their expires_at timestamp.

    Safe to run frequently (e.g., hourly). Idempotent — running multiple times
    has the same effect as running once.

    Args:
        db: Database session.

    Returns:
        Number of sessions deleted.
    """
    svc = OnboardingService(db=db)
    deleted = await svc.expire_stale_sessions()
    if deleted:
        logger.info("Expired onboarding sessions cleaned up", extra={"count": deleted})
    return deleted
