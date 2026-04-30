"""Service for donate-now page configuration and donation processing."""

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.donate_now_config import DonateNowPageConfig
from app.models.donation_tier import DonationTier
from app.models.npo import NPO
from app.schemas.donate_now_config import DonateNowConfigUpdate, DonationTierInput

_DEFAULT_TIERS = [
    (2500, 0),
    (5000, 1),
    (10000, 2),
    (25000, 3),
]


class DonateNowService:
    """Service for donate-now page configuration CRUD."""

    @staticmethod
    async def get_config(db: AsyncSession, npo_id: uuid.UUID) -> DonateNowPageConfig:
        """Get the donate-now page config for an NPO, creating one if missing."""
        stmt = (
            select(DonateNowPageConfig)
            .where(DonateNowPageConfig.npo_id == npo_id)
            .options(
                selectinload(DonateNowPageConfig.tiers),
                selectinload(DonateNowPageConfig.media_items),
                selectinload(DonateNowPageConfig.npo).selectinload(NPO.branding),
            )
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()
        if config is None:
            config = DonateNowPageConfig(
                npo_id=npo_id,
                is_enabled=False,
                processing_fee_pct=Decimal("0.0290"),
            )
            db.add(config)
            await db.flush()
            for amount_cents, display_order in _DEFAULT_TIERS:
                db.add(
                    DonationTier(
                        config_id=config.id,
                        amount_cents=amount_cents,
                        display_order=display_order,
                    )
                )
            await db.flush()
        return config

    @staticmethod
    async def update_config(
        db: AsyncSession,
        npo_id: uuid.UUID,
        data: DonateNowConfigUpdate,
    ) -> DonateNowPageConfig:
        """Update the donate-now page config for an NPO."""
        config = await DonateNowService.get_config(db, npo_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(config, field, value)
        await db.flush()
        return config

    @staticmethod
    async def upsert_tiers(
        db: AsyncSession,
        npo_id: uuid.UUID,
        tiers_input: list[DonationTierInput],
    ) -> list[DonationTier]:
        """Replace all donation tiers for an NPO's donate-now config."""
        if len(tiers_input) > 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A maximum of 10 donation tiers is allowed.",
            )
        config = await DonateNowService.get_config(db, npo_id)

        # Delete existing tiers
        stmt = select(DonationTier).where(DonationTier.config_id == config.id)
        result = await db.execute(stmt)
        for existing in result.scalars().all():
            await db.delete(existing)
        await db.flush()

        new_tiers: list[DonationTier] = []
        for i, tier_data in enumerate(tiers_input):
            tier = DonationTier(
                config_id=config.id,
                amount_cents=tier_data.amount_cents,
                impact_statement=tier_data.impact_statement,
                display_order=tier_data.display_order if tier_data.display_order else i,
            )
            db.add(tier)
            new_tiers.append(tier)
        await db.flush()
        return new_tiers

    @staticmethod
    async def get_public_config(
        db: AsyncSession,
        npo_slug: str,
    ) -> tuple[NPO, DonateNowPageConfig]:
        """Fetch NPO by slug and its donate-now config. Raises 404 if missing or disabled."""
        npo_stmt = (
            select(NPO)
            .where(NPO.slug == npo_slug)
            .options(
                selectinload(NPO.donate_now_config).selectinload(DonateNowPageConfig.tiers),
                selectinload(NPO.donate_now_config).selectinload(DonateNowPageConfig.media_items),
                selectinload(NPO.branding),
            )
        )
        npo_result = await db.execute(npo_stmt)
        npo = npo_result.scalar_one_or_none()
        if npo is None or npo.donate_now_config is None or not npo.donate_now_config.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Donate Now page not found or not enabled for this NPO.",
            )
        return npo, npo.donate_now_config
