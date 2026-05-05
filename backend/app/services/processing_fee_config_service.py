"""ProcessingFeeConfigService — manage global processing fee rate history."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.processing_fee_config import ProcessingFeeConfig


class ProcessingFeeConfigService:
    """Manage append-only processing fee rate history."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_current_rate(self) -> Decimal:
        """Return the most recently configured processing fee rate."""
        result = await self.db.execute(
            select(ProcessingFeeConfig).order_by(ProcessingFeeConfig.created_at.desc()).limit(1)
        )
        config = result.scalar_one_or_none()
        if config is None:
            return Decimal("0.0290")
        return config.rate

    async def set_rate(self, rate: Decimal, admin_user_id: uuid.UUID) -> ProcessingFeeConfig:
        """Insert a new processing fee rate record (append-only)."""
        new_config = ProcessingFeeConfig(
            rate=rate,
            created_by=admin_user_id,
        )
        self.db.add(new_config)
        await self.db.flush()
        return new_config

    async def get_history(
        self, page: int = 1, per_page: int = 20
    ) -> tuple[list[ProcessingFeeConfig], int]:
        """Return paginated history of fee rate changes.

        Returns (items, total_count).
        """
        offset = (page - 1) * per_page

        count_result = await self.db.execute(select(func.count()).select_from(ProcessingFeeConfig))
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(ProcessingFeeConfig)
            .order_by(ProcessingFeeConfig.created_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        items = list(result.scalars().all())

        return items, total
