"""PaymentProfileService — manage tokenised saved cards per donor per NPO.

Responsibilities:
- List a donor's active profiles for a given NPO
- Create a new profile after HPF vault capture
- Set/clear the default card
- Soft-delete (calls gateway vault delete first, then marks deleted_at)

FR-005  Saved cards are scoped per donor per NPO.
FR-006  Only one default card per (user, npo) — enforced here.
FR-007  Delete warns if the donor has an outstanding balance.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_profile import PaymentProfile
from app.models.payment_transaction import PaymentTransaction, TransactionStatus
from app.schemas.payment import PaymentProfileCreate, PaymentProfileRead
from app.services.payment_gateway.port import PaymentGatewayPort


class PaymentProfileService:
    """Service layer for donor saved-card ("vault") management."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Public interface ──────────────────────────────────────────────────────

    async def list_profiles(
        self,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
    ) -> Sequence[PaymentProfile]:
        """Return non-deleted profiles for this donor + NPO, default first."""
        result = await self.db.execute(
            select(PaymentProfile)
            .where(
                and_(
                    PaymentProfile.user_id == user_id,
                    PaymentProfile.npo_id == npo_id,
                    PaymentProfile.deleted_at.is_(None),
                )
            )
            .order_by(PaymentProfile.is_default.desc(), PaymentProfile.created_at.asc())
        )
        return result.scalars().all()

    async def create_profile(
        self,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        data: PaymentProfileCreate,
    ) -> PaymentProfile:
        """Persist a newly-vaulted card returned from the HPF callback.

        If `is_default=True` (or if this is the donor's first card for the NPO),
        all other cards for this donor+NPO are demoted first.
        """
        existing = await self.list_profiles(user_id, npo_id)
        should_be_default = data.is_default or len(existing) == 0

        if should_be_default and existing:
            await self._clear_default(user_id, npo_id)

        profile = PaymentProfile(
            user_id=user_id,
            npo_id=npo_id,
            gateway_profile_id=data.gateway_profile_id,
            card_last4=data.card_last4,
            card_brand=data.card_brand,
            card_expiry_month=data.card_expiry_month,
            card_expiry_year=data.card_expiry_year,
            billing_name=data.billing_name,
            billing_zip=data.billing_zip,
            is_default=should_be_default,
        )
        self.db.add(profile)
        await self.db.flush()
        await self.db.refresh(profile)
        return profile

    async def set_default(
        self,
        profile_id: uuid.UUID,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
    ) -> PaymentProfile:
        """Atomically promote one card and demote all others."""
        profile = await self._get_active_profile_or_raise(profile_id, user_id, npo_id)
        await self._clear_default(user_id, npo_id)
        profile.is_default = True
        await self.db.flush()
        await self.db.refresh(profile)
        return profile

    async def soft_delete(
        self,
        profile_id: uuid.UUID,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        gateway: PaymentGatewayPort,
    ) -> dict[str, str | None]:
        """Delete vault token from gateway then soft-delete in DB.

        Returns ``{"warning": str | None}`` — warning is set when the donor
        has an outstanding (pending/authorized) balance for this NPO.
        """
        profile = await self._get_active_profile_or_raise(profile_id, user_id, npo_id)

        # Call gateway to remove the vault token
        await gateway.delete_profile(profile.gateway_profile_id)

        # Mark deleted
        profile.deleted_at = datetime.now(UTC)

        # If this was the default, promote the oldest remaining card
        if profile.is_default:
            profile.is_default = False
            await self.db.flush()
            await self._promote_oldest(user_id, npo_id, exclude_id=profile_id)

        await self.db.flush()

        warning = await self._outstanding_balance_warning(user_id, npo_id)
        return {"warning": warning}

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_active_profile_or_raise(
        self,
        profile_id: uuid.UUID,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
    ) -> PaymentProfile:
        from fastapi import HTTPException, status

        result = await self.db.execute(
            select(PaymentProfile).where(
                and_(
                    PaymentProfile.id == profile_id,
                    PaymentProfile.user_id == user_id,
                    PaymentProfile.npo_id == npo_id,
                    PaymentProfile.deleted_at.is_(None),
                )
            )
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment profile not found",
            )
        return profile

    async def _clear_default(self, user_id: uuid.UUID, npo_id: uuid.UUID) -> None:
        """Set is_default=False on all active profiles for this donor+NPO."""
        await self.db.execute(
            update(PaymentProfile)
            .where(
                and_(
                    PaymentProfile.user_id == user_id,
                    PaymentProfile.npo_id == npo_id,
                    PaymentProfile.is_default.is_(True),
                    PaymentProfile.deleted_at.is_(None),
                )
            )
            .values(is_default=False)
        )

    async def _promote_oldest(
        self,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
        exclude_id: uuid.UUID,
    ) -> None:
        """Promote the oldest non-deleted card as default (if any remain)."""
        result = await self.db.execute(
            select(PaymentProfile)
            .where(
                and_(
                    PaymentProfile.user_id == user_id,
                    PaymentProfile.npo_id == npo_id,
                    PaymentProfile.id != exclude_id,
                    PaymentProfile.deleted_at.is_(None),
                )
            )
            .order_by(PaymentProfile.created_at.asc())
            .limit(1)
        )
        oldest = result.scalar_one_or_none()
        if oldest is not None:
            oldest.is_default = True

    async def _outstanding_balance_warning(
        self,
        user_id: uuid.UUID,
        npo_id: uuid.UUID,
    ) -> str | None:
        """Return a warning string if donor has unpaid/pending amounts for this NPO."""
        result = await self.db.execute(
            select(PaymentTransaction)
            .where(
                and_(
                    PaymentTransaction.user_id == user_id,
                    PaymentTransaction.npo_id == npo_id,
                    PaymentTransaction.status.in_(
                        [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED]
                    ),
                )
            )
            .limit(1)
        )
        outstanding = result.scalar_one_or_none()
        if outstanding is not None:
            return (
                "You have an outstanding balance with this organisation. "
                "Removing your saved card may affect your ability to complete payment."
            )
        return None


def profile_to_read(profile: PaymentProfile) -> PaymentProfileRead:
    """Convert ORM model → Pydantic response schema."""
    return PaymentProfileRead.model_validate(profile)
