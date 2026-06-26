"""Service for event-level silent auction anti-sniping extension rules."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType
from app.models.event import Event
from app.models.silent_auction_extension_policy import (
    SilentAuctionExtensionPolicy,
    SilentAuctionItemExtensionState,
)


@dataclass
class ExtensionEvaluationResult:
    extension_applied_minutes: int
    item_effective_close_at: object | None
    max_extension_reached: bool


class SilentAuctionExtensionService:
    """Event-level anti-sniping extension policy orchestration."""

    DEFAULT_TRIGGER_WINDOW_MINUTES = 3
    DEFAULT_EXTENSION_DURATION_MINUTES = 3
    DEFAULT_MAX_TOTAL_EXTENSION_MINUTES = 30

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_event(self, event_id: UUID) -> Event:
        event = (
            await self.db.execute(select(Event).where(Event.id == event_id))
        ).scalar_one_or_none()
        if not event:
            raise ValueError("Event not found")
        return event

    async def get_or_create_policy(
        self,
        event_id: UUID,
        updated_by_user_id: UUID | None = None,
    ) -> SilentAuctionExtensionPolicy:
        policy = (
            await self.db.execute(
                select(SilentAuctionExtensionPolicy).where(
                    SilentAuctionExtensionPolicy.event_id == event_id
                )
            )
        ).scalar_one_or_none()
        if policy:
            return policy

        policy = SilentAuctionExtensionPolicy(
            event_id=event_id,
            auto_extension_enabled=True,
            trigger_window_minutes=self.DEFAULT_TRIGGER_WINDOW_MINUTES,
            extension_duration_minutes=self.DEFAULT_EXTENSION_DURATION_MINUTES,
            max_total_extension_minutes=self.DEFAULT_MAX_TOTAL_EXTENSION_MINUTES,
            updated_by_user_id=updated_by_user_id,
        )
        self.db.add(policy)
        await self.db.flush()
        return policy

    async def get_policy(self, event_id: UUID) -> SilentAuctionExtensionPolicy:
        await self._get_event(event_id)
        return await self.get_or_create_policy(event_id)

    async def update_policy(
        self,
        event_id: UUID,
        auto_extension_enabled: bool,
        extension_duration_minutes: int,
        max_total_extension_minutes: int,
        updated_by_user_id: UUID | None,
    ) -> SilentAuctionExtensionPolicy:
        await self._get_event(event_id)

        if extension_duration_minutes < 1 or extension_duration_minutes > 10:
            raise ValueError("extension_duration_minutes must be between 1 and 10")
        if max_total_extension_minutes < 0 or max_total_extension_minutes > 60:
            raise ValueError("max_total_extension_minutes must be between 0 and 60")

        policy = await self.get_or_create_policy(event_id, updated_by_user_id=updated_by_user_id)
        policy.auto_extension_enabled = auto_extension_enabled
        policy.extension_duration_minutes = extension_duration_minutes
        policy.max_total_extension_minutes = max_total_extension_minutes
        policy.updated_by_user_id = updated_by_user_id
        await self.db.flush()
        return policy

    async def _get_or_create_item_state(
        self,
        event_id: UUID,
        auction_item_id: UUID,
        original_close_at: datetime,
    ) -> SilentAuctionItemExtensionState:
        state = (
            await self.db.execute(
                select(SilentAuctionItemExtensionState).where(
                    SilentAuctionItemExtensionState.event_id == event_id,
                    SilentAuctionItemExtensionState.auction_item_id == auction_item_id,
                )
            )
        ).scalar_one_or_none()
        if state:
            return state

        state = SilentAuctionItemExtensionState(
            event_id=event_id,
            auction_item_id=auction_item_id,
            original_close_at=original_close_at,
            effective_close_at=original_close_at,
            total_extension_minutes_applied=0,
        )
        self.db.add(state)
        await self.db.flush()
        return state

    async def get_effective_close_for_item(
        self,
        event_id: UUID,
        auction_item_id: UUID,
    ) -> SilentAuctionItemExtensionState | None:
        event = await self._get_event(event_id)
        if not event.auction_close_datetime:
            return None
        return await self._get_or_create_item_state(
            event_id=event_id,
            auction_item_id=auction_item_id,
            original_close_at=event.auction_close_datetime,
        )

    async def evaluate_and_apply_extension(
        self,
        event_id: UUID,
        auction_item_id: UUID,
        accepted_at: datetime,
    ) -> ExtensionEvaluationResult:
        policy = await self.get_or_create_policy(event_id)

        item = (
            await self.db.execute(select(AuctionItem).where(AuctionItem.id == auction_item_id))
        ).scalar_one_or_none()
        if not item:
            raise ValueError("Auction item not found")
        if item.auction_type != AuctionType.SILENT.value:
            return ExtensionEvaluationResult(0, None, False)

        event = await self._get_event(event_id)
        if not event.auction_close_datetime:
            return ExtensionEvaluationResult(0, None, False)

        state = await self._get_or_create_item_state(
            event_id=event_id,
            auction_item_id=auction_item_id,
            original_close_at=event.auction_close_datetime,
        )

        max_close = state.original_close_at + timedelta(minutes=policy.max_total_extension_minutes)
        max_extension_reached = state.effective_close_at >= max_close

        if not policy.auto_extension_enabled or max_extension_reached:
            return ExtensionEvaluationResult(
                extension_applied_minutes=0,
                item_effective_close_at=state.effective_close_at,
                max_extension_reached=max_extension_reached,
            )

        trigger_window_start = state.effective_close_at - timedelta(
            minutes=policy.trigger_window_minutes
        )
        qualifies = trigger_window_start <= accepted_at <= state.effective_close_at
        if not qualifies:
            return ExtensionEvaluationResult(
                extension_applied_minutes=0,
                item_effective_close_at=state.effective_close_at,
                max_extension_reached=max_extension_reached,
            )

        remaining_minutes = int((max_close - state.effective_close_at).total_seconds() // 60)
        if remaining_minutes <= 0:
            return ExtensionEvaluationResult(
                extension_applied_minutes=0,
                item_effective_close_at=state.effective_close_at,
                max_extension_reached=True,
            )

        applied_minutes = min(policy.extension_duration_minutes, remaining_minutes)
        state.effective_close_at = state.effective_close_at + timedelta(minutes=applied_minutes)
        state.total_extension_minutes_applied = (
            state.total_extension_minutes_applied + applied_minutes
        )
        await self.db.flush()

        return ExtensionEvaluationResult(
            extension_applied_minutes=applied_minutes,
            item_effective_close_at=state.effective_close_at,
            max_extension_reached=state.effective_close_at >= max_close,
        )
