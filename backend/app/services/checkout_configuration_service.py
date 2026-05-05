"""CheckoutConfigurationService — manage per-event checkout settings."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.checkout_configuration import CheckoutConfiguration
from app.models.processing_fee_config import ProcessingFeeConfig

logger = get_logger(__name__)


class CheckoutConfigurationService:
    """Manage per-event checkout configuration lifecycle."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create(self, event_id: uuid.UUID) -> CheckoutConfiguration:
        """Get existing checkout configuration or create a new one for the event."""
        result = await self.db.execute(
            select(CheckoutConfiguration).where(CheckoutConfiguration.event_id == event_id)
        )
        config = result.scalar_one_or_none()
        if config is None:
            config = CheckoutConfiguration(event_id=event_id)
            self.db.add(config)
            await self.db.flush()
        return config

    async def open_checkout(self, event_id: uuid.UUID) -> CheckoutConfiguration:
        """Open checkout for an event.

        If processing_fee_rate is not yet set, snapshots the current global rate.
        Sets is_open=True, donor_visible=True, opened_at=now().
        """
        config = await self.get_or_create(event_id)

        # Only snapshot fee rate if not already set
        if config.processing_fee_rate is None:
            current_rate = await self._get_current_fee_rate()
            config.processing_fee_rate = current_rate

        config.is_open = True
        config.donor_visible = True
        config.opened_at = datetime.now(UTC)
        config.celery_task_id = None
        config.scheduled_open_at = None

        return config

    async def close_checkout(self, event_id: uuid.UUID) -> CheckoutConfiguration:
        """Close checkout for an event."""
        config = await self.get_or_create(event_id)
        config.is_open = False
        return config

    async def schedule_open(self, event_id: uuid.UUID, open_at: datetime) -> CheckoutConfiguration:
        """Schedule checkout to auto-open at a specific datetime.

        Cancels any existing scheduled task before scheduling the new one.
        """
        from app.tasks.checkout_tasks import auto_open_checkout_task

        config = await self.get_or_create(event_id)

        # Cancel existing task if any
        if config.celery_task_id:
            await self._revoke_task(config.celery_task_id)

        result = auto_open_checkout_task.apply_async(
            args=[str(event_id)],
            eta=open_at,
        )
        config.celery_task_id = result.id
        config.scheduled_open_at = open_at

        return config

    async def cancel_schedule(self, event_id: uuid.UUID) -> CheckoutConfiguration:
        """Cancel a scheduled auto-open task."""
        config = await self.get_or_create(event_id)

        if config.celery_task_id:
            await self._revoke_task(config.celery_task_id)

        config.celery_task_id = None
        config.scheduled_open_at = None

        return config

    async def update_configuration(
        self,
        event_id: uuid.UUID,
        cash_instructions: str | None = None,
        donor_visible: bool | None = None,
    ) -> CheckoutConfiguration:
        """Update editable checkout configuration fields."""
        config = await self.get_or_create(event_id)

        if cash_instructions is not None:
            config.cash_instructions = cash_instructions
        if donor_visible is not None:
            config.donor_visible = donor_visible

        return config

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_current_fee_rate(self) -> Decimal:
        """Get the most recent processing fee rate."""
        result = await self.db.execute(
            select(ProcessingFeeConfig).order_by(ProcessingFeeConfig.created_at.desc()).limit(1)
        )
        config = result.scalar_one_or_none()
        if config is None:
            # Fallback to default if no config exists
            return Decimal("0.0290")
        return config.rate

    async def _revoke_task(self, task_id: str) -> None:
        """Revoke a Celery task by ID."""
        try:
            from app.celery_app import celery_app

            celery_app.control.revoke(task_id, terminate=False)
        except Exception:
            logger.warning(f"Failed to revoke Celery task {task_id}", exc_info=True)
