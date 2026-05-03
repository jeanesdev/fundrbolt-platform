"""Service layer for Revenue Generator feature."""

from __future__ import annotations

import logging
import random
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registration_guest import RegistrationGuest
from app.models.revenue_generator_entry import RevenueGeneratorEntry
from app.models.revenue_generator_item import RevenueGeneratorItem
from app.models.revenue_generator_winner_selection import (
    RevenueGeneratorWinnerSelection,
    WinnerSelectionMethod,
)
from app.schemas.revenue_generator import (
    EntryPurchaseResponse,
    EntryRow,
    ManualWinnerSelectRequest,
    QuickEntryRevenueGeneratorEntryResponse,
    QuickEntryRevenueGeneratorItem,
    QuickEntryRevenueGeneratorItemListResponse,
    QuickEntryRGHistoryItem,
    QuickEntryRGHistoryResponse,
    RevenueGeneratorAdminListResponse,
    RevenueGeneratorDashboardSummary,
    RevenueGeneratorDonorListResponse,
    RevenueGeneratorEntryListResponse,
    RevenueGeneratorItemAdminResponse,
    RevenueGeneratorItemCreate,
    RevenueGeneratorItemDonorResponse,
    RevenueGeneratorItemSummary,
    RevenueGeneratorItemUpdate,
    WinnerHistoryResponse,
    WinnerSelectionResponse,
)

logger = logging.getLogger(__name__)


def _resolve_image_url(image_url: str | None, image_blob_name: str | None) -> str | None:
    """Return a SAS-signed image URL if Azure is configured, else the raw URL."""
    if not image_url:
        return None
    if not image_blob_name:
        return image_url
    try:
        from app.core.config import get_settings
        from app.services.sponsor_logo_service import SponsorLogoService

        get_settings()  # ensure settings loaded
        return SponsorLogoService.generate_blob_sas_url(image_blob_name, expiry_hours=24)
    except Exception:
        return image_url


class RevenueGeneratorService:
    """Handles all business logic for Revenue Generator items."""

    # ── Admin: Item CRUD ────────────────────────────────────────────────────

    @staticmethod
    async def list_items_admin(
        db: AsyncSession, event_id: uuid.UUID
    ) -> RevenueGeneratorAdminListResponse:
        stmt = (
            select(RevenueGeneratorItem)
            .where(RevenueGeneratorItem.event_id == event_id)
            .order_by(RevenueGeneratorItem.display_order, RevenueGeneratorItem.created_at)
        )
        result = await db.execute(stmt)
        items = result.scalars().all()

        item_ids = [item.id for item in items]
        entry_stats_bulk = await RevenueGeneratorService._get_entry_stats_bulk(db, item_ids)
        winner_bulk = await RevenueGeneratorService._get_current_winner_bulk(db, item_ids)

        response_items = [
            RevenueGeneratorItemAdminResponse(
                id=item.id,
                event_id=item.event_id,
                name=item.name,
                description=item.description,
                price_per_entry=item.price_per_entry,
                max_entries=item.max_entries,
                image_url=_resolve_image_url(item.image_url, item.image_blob_name),
                is_visible=item.is_visible,
                is_open_for_entries=item.is_open_for_entries,
                display_order=item.display_order,
                total_entries=entry_stats_bulk.get(item.id, (0, Decimal("0.00")))[0],
                total_revenue=entry_stats_bulk.get(item.id, (0, Decimal("0.00")))[1],
                current_winner_name=winner_bulk.get(item.id, (None, None))[0],
                current_winner_bidder_number=winner_bulk.get(item.id, (None, None))[1],
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in items
        ]
        return RevenueGeneratorAdminListResponse(items=response_items)

    @staticmethod
    async def create_item(
        db: AsyncSession,
        event_id: uuid.UUID,
        data: RevenueGeneratorItemCreate,
        created_by: uuid.UUID,
    ) -> RevenueGeneratorItemAdminResponse:
        item = RevenueGeneratorItem(
            event_id=event_id,
            created_by=created_by,
            name=data.name,
            description=data.description,
            price_per_entry=data.price_per_entry,
            max_entries=data.max_entries,
            display_order=data.display_order,
        )
        db.add(item)
        await db.flush()
        logger.info("Created revenue generator item %s for event %s", item.id, event_id)
        return RevenueGeneratorItemAdminResponse(
            id=item.id,
            event_id=item.event_id,
            name=item.name,
            description=item.description,
            price_per_entry=item.price_per_entry,
            max_entries=item.max_entries,
            image_url=None,
            is_visible=item.is_visible,
            is_open_for_entries=item.is_open_for_entries,
            display_order=item.display_order,
            total_entries=0,
            total_revenue=Decimal("0.00"),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    async def get_item_admin(db: AsyncSession, item_id: uuid.UUID) -> RevenueGeneratorItem | None:
        result = await db.execute(
            select(RevenueGeneratorItem).where(RevenueGeneratorItem.id == item_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_item(
        db: AsyncSession,
        item: RevenueGeneratorItem,
        data: RevenueGeneratorItemUpdate,
    ) -> RevenueGeneratorItemAdminResponse:
        if data.name is not None:
            item.name = data.name
        if data.description is not None:
            item.description = data.description
        if data.price_per_entry is not None:
            item.price_per_entry = data.price_per_entry
        if data.max_entries is not None:
            item.max_entries = data.max_entries
        if data.is_visible is not None:
            item.is_visible = data.is_visible
        if data.is_open_for_entries is not None:
            item.is_open_for_entries = data.is_open_for_entries
        if data.display_order is not None:
            item.display_order = data.display_order
        await db.flush()
        await db.refresh(item)
        entry_stats = await RevenueGeneratorService._get_entry_stats(db, item.id)
        winner = await RevenueGeneratorService._get_current_winner(db, item.id)
        return RevenueGeneratorItemAdminResponse(
            id=item.id,
            event_id=item.event_id,
            name=item.name,
            description=item.description,
            price_per_entry=item.price_per_entry,
            max_entries=item.max_entries,
            image_url=_resolve_image_url(item.image_url, item.image_blob_name),
            is_visible=item.is_visible,
            is_open_for_entries=item.is_open_for_entries,
            display_order=item.display_order,
            total_entries=entry_stats[0],
            total_revenue=entry_stats[1],
            current_winner_name=winner[0] if winner else None,
            current_winner_bidder_number=winner[1] if winner else None,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    async def delete_item(db: AsyncSession, item: RevenueGeneratorItem) -> None:
        await db.delete(item)
        await db.flush()
        logger.info("Deleted revenue generator item %s", item.id)

    # ── Admin: Entries ──────────────────────────────────────────────────────

    @staticmethod
    async def list_entries_admin(
        db: AsyncSession,
        item_id: uuid.UUID,
        page: int = 1,
        per_page: int = 50,
    ) -> RevenueGeneratorEntryListResponse:
        from sqlalchemy.orm import selectinload

        stmt = (
            select(RevenueGeneratorEntry)
            .options(
                selectinload(RevenueGeneratorEntry.registration_guest).selectinload(
                    RegistrationGuest.user
                )
            )
            .where(RevenueGeneratorEntry.revenue_generator_item_id == item_id)
            .order_by(RevenueGeneratorEntry.purchased_at.desc())
        )
        result = await db.execute(stmt)
        entries = result.scalars().all()

        @dataclass
        class _BidderGroup:
            registration_guest_id: UUID | None
            bidder_number: int
            donor_name: str
            profile_picture_url: str | None
            table_number: int | None
            entry_count: int
            total_paid: Decimal
            last_purchased_at: datetime

        # Group by bidder_number
        grouped: dict[int, _BidderGroup] = {}
        for e in entries:
            k = e.bidder_number
            if k not in grouped:
                guest = e.registration_guest
                donor_name: str
                profile_picture_url: str | None = None
                table_number: int | None = None
                if guest:
                    # Prefer the guest's own name field; fall back to linked user full name
                    if guest.name:
                        donor_name = guest.name
                    elif guest.user:
                        first = getattr(guest.user, "first_name", "") or ""
                        last = getattr(guest.user, "last_name", "") or ""
                        donor_name = f"{first} {last}".strip() or f"Bidder #{k}"
                    else:
                        donor_name = f"Bidder #{k}"
                    table_number = guest.table_number
                    profile_picture_url = guest.user.profile_picture_url if guest.user else None
                else:
                    donor_name = f"Bidder #{k}"
                grouped[k] = _BidderGroup(
                    registration_guest_id=e.registration_guest_id,
                    bidder_number=k,
                    donor_name=donor_name,
                    profile_picture_url=profile_picture_url,
                    table_number=table_number,
                    entry_count=0,
                    total_paid=Decimal("0.00"),
                    last_purchased_at=e.purchased_at,
                )
            grouped[k].entry_count += 1
            grouped[k].total_paid += e.amount_paid
            if e.purchased_at > grouped[k].last_purchased_at:
                grouped[k].last_purchased_at = e.purchased_at

        rows = sorted(
            [
                EntryRow(
                    registration_guest_id=g.registration_guest_id,
                    bidder_number=g.bidder_number,
                    donor_name=g.donor_name,
                    profile_picture_url=g.profile_picture_url,
                    table_number=g.table_number,
                    entry_count=g.entry_count,
                    total_paid=g.total_paid,
                    last_purchased_at=g.last_purchased_at,
                )
                for g in grouped.values()
            ],
            key=lambda r: r.entry_count,
            reverse=True,
        )
        total = len(rows)
        start = (page - 1) * per_page
        rows_page = rows[start : start + per_page]
        total_revenue = Decimal(str(sum(e.amount_paid for e in entries)))

        return RevenueGeneratorEntryListResponse(
            item_id=item_id,
            entries=rows_page,
            total_entries=len(entries),
            total_revenue=total_revenue,
            page=page,
            per_page=per_page,
            total_pages=(total + per_page - 1) // per_page if per_page > 0 else 1,
        )

    # ── Admin: Winner Selection ─────────────────────────────────────────────

    @staticmethod
    async def draw_random_winner(
        db: AsyncSession,
        item_id: uuid.UUID,
        selected_by_user_id: uuid.UUID,
    ) -> WinnerSelectionResponse:
        entries_stmt = select(RevenueGeneratorEntry).where(
            RevenueGeneratorEntry.revenue_generator_item_id == item_id
        )
        result = await db.execute(entries_stmt)
        entries = result.scalars().all()
        if not entries:
            raise ValueError("No entries to draw from")

        winning_entry = random.choice(entries)
        winner_name = (
            await RevenueGeneratorService._get_guest_name(db, winning_entry.registration_guest_id)
            or f"Bidder #{winning_entry.bidder_number}"
        )

        selection = RevenueGeneratorWinnerSelection(
            revenue_generator_item_id=item_id,
            winning_entry_id=winning_entry.id,
            winner_name=winner_name,
            bidder_number=winning_entry.bidder_number,
            selection_method=WinnerSelectionMethod.RANDOM_DRAW,
            selected_by_user_id=selected_by_user_id,
        )
        db.add(selection)
        await db.flush()
        logger.info(
            "Random winner drawn for item %s: bidder #%d", item_id, winning_entry.bidder_number
        )
        return WinnerSelectionResponse(
            id=selection.id,
            item_id=selection.revenue_generator_item_id,
            winner_name=selection.winner_name,
            bidder_number=selection.bidder_number,
            selection_method=selection.selection_method.value,
            selected_at=selection.selected_at,
            selected_by_user_id=selection.selected_by_user_id,
        )

    @staticmethod
    async def select_manual_winner(
        db: AsyncSession,
        item_id: uuid.UUID,
        data: ManualWinnerSelectRequest,
        selected_by_user_id: uuid.UUID,
    ) -> WinnerSelectionResponse:
        entry_stmt = (
            select(RevenueGeneratorEntry)
            .where(
                RevenueGeneratorEntry.revenue_generator_item_id == item_id,
                RevenueGeneratorEntry.registration_guest_id == data.registration_guest_id,
            )
            .limit(1)
        )
        result = await db.execute(entry_stmt)
        entry = result.scalar_one_or_none()
        if not entry:
            raise ValueError("No entry found for this guest")

        winner_name = (
            await RevenueGeneratorService._get_guest_name(db, entry.registration_guest_id)
            or f"Bidder #{entry.bidder_number}"
        )

        selection = RevenueGeneratorWinnerSelection(
            revenue_generator_item_id=item_id,
            winning_entry_id=entry.id,
            winner_name=winner_name,
            bidder_number=entry.bidder_number,
            selection_method=WinnerSelectionMethod.MANUAL,
            selected_by_user_id=selected_by_user_id,
        )
        db.add(selection)
        await db.flush()
        return WinnerSelectionResponse(
            id=selection.id,
            item_id=selection.revenue_generator_item_id,
            winner_name=selection.winner_name,
            bidder_number=selection.bidder_number,
            selection_method=selection.selection_method.value,
            selected_at=selection.selected_at,
            selected_by_user_id=selection.selected_by_user_id,
        )

    @staticmethod
    async def get_winner_history(db: AsyncSession, item_id: uuid.UUID) -> WinnerHistoryResponse:
        stmt = (
            select(RevenueGeneratorWinnerSelection)
            .where(RevenueGeneratorWinnerSelection.revenue_generator_item_id == item_id)
            .order_by(RevenueGeneratorWinnerSelection.selected_at.desc())
        )
        result = await db.execute(stmt)
        selections = result.scalars().all()
        history = [
            WinnerSelectionResponse(
                id=s.id,
                item_id=s.revenue_generator_item_id,
                winner_name=s.winner_name,
                bidder_number=s.bidder_number,
                selection_method=s.selection_method.value,
                selected_at=s.selected_at,
                selected_by_user_id=s.selected_by_user_id,
            )
            for s in selections
        ]
        return WinnerHistoryResponse(item_id=item_id, history=history)

    # ── Donor: Items ────────────────────────────────────────────────────────

    @staticmethod
    async def list_items_donor(
        db: AsyncSession, event_id: uuid.UUID, donor_user_id: uuid.UUID | None = None
    ) -> RevenueGeneratorDonorListResponse:
        stmt = (
            select(RevenueGeneratorItem)
            .where(
                RevenueGeneratorItem.event_id == event_id,
                RevenueGeneratorItem.is_visible.is_(True),
            )
            .order_by(RevenueGeneratorItem.display_order, RevenueGeneratorItem.created_at)
        )
        result = await db.execute(stmt)
        items = result.scalars().all()

        response_items = []
        for item in items:
            my_count = 0
            if donor_user_id:
                my_count = await RevenueGeneratorService._get_my_entry_count(
                    db, item.id, donor_user_id
                )
            winner = await RevenueGeneratorService._get_current_winner(db, item.id)
            response_items.append(
                RevenueGeneratorItemDonorResponse(
                    id=item.id,
                    name=item.name,
                    description=item.description,
                    price_per_entry=item.price_per_entry,
                    max_entries=item.max_entries,
                    image_url=_resolve_image_url(item.image_url, item.image_blob_name),
                    is_open_for_entries=item.is_open_for_entries,
                    my_entry_count=my_count,
                    current_winner_name=winner[0] if winner else None,
                )
            )
        return RevenueGeneratorDonorListResponse(items=response_items)

    @staticmethod
    async def create_donor_entry(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
        donor_user_id: uuid.UUID,
    ) -> EntryPurchaseResponse:
        """Purchase one entry for a donor (self-service via donor PWA)."""
        from app.models.event_registration import EventRegistration

        # Verify item exists and is open
        item_result = await db.execute(
            select(RevenueGeneratorItem).where(
                RevenueGeneratorItem.id == item_id,
                RevenueGeneratorItem.event_id == event_id,
            )
        )
        item = item_result.scalar_one_or_none()
        if not item:
            raise ValueError("Revenue generator item not found")
        if not item.is_visible:
            raise ValueError("This item is not available")
        if not item.is_open_for_entries:
            raise ValueError("This item is not open for entries")

        # Enforce max_entries limit if set
        if item.max_entries is not None:
            total_stmt = select(func.count()).where(
                RevenueGeneratorEntry.revenue_generator_item_id == item_id,
            )
            total_result = await db.execute(total_stmt)
            total = total_result.scalar_one() or 0
            if total >= item.max_entries:
                raise ValueError("This item has reached its maximum number of entries")

        # Find donor's primary guest for this event
        guest_stmt = (
            select(RegistrationGuest)
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == donor_user_id,
                RegistrationGuest.is_primary.is_(True),
            )
            .limit(1)
        )
        guest_result = await db.execute(guest_stmt)
        guest = guest_result.scalar_one_or_none()

        entry = RevenueGeneratorEntry(
            revenue_generator_item_id=item_id,
            event_id=event_id,
            registration_guest_id=guest.id if guest else None,
            bidder_number=guest.bidder_number if (guest and guest.bidder_number) else 0,
            amount_paid=item.price_per_entry,
            recorded_by_user_id=donor_user_id,
        )
        db.add(entry)
        await db.flush()

        # Count total entries for this donor on this item
        my_count = await RevenueGeneratorService._get_my_entry_count(db, item_id, donor_user_id)

        return EntryPurchaseResponse(
            entry_id=entry.id,
            item_id=item_id,
            my_entry_count=my_count,
            amount_paid=item.price_per_entry,
        )

    # ── Quick Entry ─────────────────────────────────────────────────────────

    @staticmethod
    async def list_items_quick_entry(
        db: AsyncSession, event_id: uuid.UUID
    ) -> QuickEntryRevenueGeneratorItemListResponse:
        stmt = (
            select(RevenueGeneratorItem)
            .where(
                RevenueGeneratorItem.event_id == event_id,
                RevenueGeneratorItem.is_open_for_entries.is_(True),
            )
            .order_by(RevenueGeneratorItem.display_order)
        )
        result = await db.execute(stmt)
        items = result.scalars().all()
        return QuickEntryRevenueGeneratorItemListResponse(
            items=[
                QuickEntryRevenueGeneratorItem(
                    id=i.id,
                    name=i.name,
                    price_per_entry=i.price_per_entry,
                )
                for i in items
            ]
        )

    @staticmethod
    async def record_quick_entry(
        db: AsyncSession,
        event_id: uuid.UUID,
        item_id: uuid.UUID,
        bidder_number: int,
        recorded_by_user_id: uuid.UUID,
    ) -> QuickEntryRevenueGeneratorEntryResponse:
        item_result = await db.execute(
            select(RevenueGeneratorItem).where(
                RevenueGeneratorItem.id == item_id,
                RevenueGeneratorItem.event_id == event_id,
            )
        )
        item = item_result.scalar_one_or_none()
        if not item:
            raise ValueError("Item not found for this event")
        if not item.is_open_for_entries:
            raise ValueError("Item is not open for entries")

        # Look up guest by bidder number (via EventRegistration join)
        from app.models.event_registration import EventRegistration

        guest_stmt = (
            select(RegistrationGuest)
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number == bidder_number,
            )
            .limit(1)
        )
        guest_result = await db.execute(guest_stmt)
        guest = guest_result.scalar_one_or_none()

        if guest is None:
            raise ValueError(f"Bidder #{bidder_number} is not assigned to a donor for this event")

        entry = RevenueGeneratorEntry(
            revenue_generator_item_id=item_id,
            event_id=event_id,
            registration_guest_id=guest.id,
            bidder_number=bidder_number,
            amount_paid=item.price_per_entry,
            recorded_by_user_id=recorded_by_user_id,
        )
        db.add(entry)
        await db.flush()

        # Count entries for this bidder on this item
        count_stmt = select(func.count()).where(
            RevenueGeneratorEntry.revenue_generator_item_id == item_id,
            RevenueGeneratorEntry.bidder_number == bidder_number,
        )
        count_result = await db.execute(count_stmt)
        entry_count = count_result.scalar_one() or 0

        donor_name: str | None = guest.name or None

        return QuickEntryRevenueGeneratorEntryResponse(
            entry_id=entry.id,
            item_id=item_id,
            item_name=item.name,
            bidder_number=bidder_number,
            donor_name=donor_name,
            table_number=guest.table_number,
            entry_count_for_item=entry_count,
            amount_paid=item.price_per_entry,
        )

    @staticmethod
    async def list_all_entries_quick_entry(
        db: AsyncSession, event_id: uuid.UUID
    ) -> QuickEntryRGHistoryResponse:
        """Return all entries for this event's revenue generators, newest first."""
        from app.models.revenue_generator_item import RevenueGeneratorItem as RGItem

        stmt = (
            select(
                RevenueGeneratorEntry,
                RGItem.name.label("item_name"),
                RegistrationGuest.name.label("donor_name"),
                RegistrationGuest.table_number.label("table_number"),
            )
            .join(RGItem, RevenueGeneratorEntry.revenue_generator_item_id == RGItem.id)
            .outerjoin(
                RegistrationGuest,
                RevenueGeneratorEntry.registration_guest_id == RegistrationGuest.id,
            )
            .where(RevenueGeneratorEntry.event_id == event_id)
            .order_by(RevenueGeneratorEntry.purchased_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.all()

        # Count entries per (bidder, item) for the entry_count_for_item field
        from sqlalchemy import func as sa_func

        count_stmt = (
            select(
                RevenueGeneratorEntry.bidder_number,
                RevenueGeneratorEntry.revenue_generator_item_id,
                sa_func.count().label("cnt"),
            )
            .where(RevenueGeneratorEntry.event_id == event_id)
            .group_by(
                RevenueGeneratorEntry.bidder_number,
                RevenueGeneratorEntry.revenue_generator_item_id,
            )
        )
        count_result = await db.execute(count_stmt)
        counts: dict[tuple[int, uuid.UUID], int] = {
            (r.bidder_number, r.revenue_generator_item_id): r.cnt for r in count_result.all()
        }

        entries = [
            QuickEntryRGHistoryItem(
                entry_id=row.RevenueGeneratorEntry.id,
                item_id=row.RevenueGeneratorEntry.revenue_generator_item_id,
                item_name=row.item_name,
                bidder_number=row.RevenueGeneratorEntry.bidder_number,
                donor_name=row.donor_name,
                table_number=row.table_number,
                entry_count_for_item=counts.get(
                    (
                        row.RevenueGeneratorEntry.bidder_number,
                        row.RevenueGeneratorEntry.revenue_generator_item_id,
                    ),
                    1,
                ),
                amount_paid=row.RevenueGeneratorEntry.amount_paid,
                purchased_at=row.RevenueGeneratorEntry.purchased_at.isoformat(),
            )
            for row in rows
        ]
        return QuickEntryRGHistoryResponse(entries=entries)

    # ── Dashboard ───────────────────────────────────────────────────────────

    @staticmethod
    async def get_dashboard_summary(
        db: AsyncSession, event_id: uuid.UUID
    ) -> RevenueGeneratorDashboardSummary:
        items_stmt = (
            select(RevenueGeneratorItem)
            .where(RevenueGeneratorItem.event_id == event_id)
            .order_by(RevenueGeneratorItem.display_order)
        )
        items_result = await db.execute(items_stmt)
        items = items_result.scalars().all()

        item_ids = [item.id for item in items]
        entry_stats_bulk = await RevenueGeneratorService._get_entry_stats_bulk(db, item_ids)
        winner_bulk = await RevenueGeneratorService._get_current_winner_bulk(db, item_ids)

        item_summaries = []
        total_entries = 0
        total_revenue = Decimal("0.00")

        for item in items:
            stats = entry_stats_bulk.get(item.id, (0, Decimal("0.00")))
            winner = winner_bulk.get(item.id)
            total_entries += stats[0]
            total_revenue += stats[1]
            item_summaries.append(
                RevenueGeneratorItemSummary(
                    id=item.id,
                    name=item.name,
                    entry_count=stats[0],
                    revenue=stats[1],
                    current_winner_name=winner[0] if winner else None,
                )
            )

        return RevenueGeneratorDashboardSummary(
            total_entries=total_entries,
            total_revenue=total_revenue,
            items=item_summaries,
        )

    # ── Private helpers ─────────────────────────────────────────────────────

    @staticmethod
    async def _get_entry_stats(db: AsyncSession, item_id: uuid.UUID) -> tuple[int, Decimal]:
        stmt = select(
            func.count(RevenueGeneratorEntry.id),
            func.coalesce(func.sum(RevenueGeneratorEntry.amount_paid), Decimal("0.00")),
        ).where(RevenueGeneratorEntry.revenue_generator_item_id == item_id)
        result = await db.execute(stmt)
        row = result.one()
        count = row[0] or 0
        revenue = row[1] or Decimal("0.00")
        return count, revenue

    @staticmethod
    async def _get_current_winner(db: AsyncSession, item_id: uuid.UUID) -> tuple[str, int] | None:
        stmt = (
            select(RevenueGeneratorWinnerSelection)
            .where(RevenueGeneratorWinnerSelection.revenue_generator_item_id == item_id)
            .order_by(RevenueGeneratorWinnerSelection.selected_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        selection = result.scalar_one_or_none()
        if not selection:
            return None
        return selection.winner_name, selection.bidder_number

    @staticmethod
    async def _get_entry_stats_bulk(
        db: AsyncSession, item_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[int, Decimal]]:
        """Bulk version of _get_entry_stats to avoid N+1 queries."""
        if not item_ids:
            return {}

        stmt = (
            select(
                RevenueGeneratorEntry.revenue_generator_item_id,
                func.count(RevenueGeneratorEntry.id).label("cnt"),
                func.coalesce(func.sum(RevenueGeneratorEntry.amount_paid), Decimal("0.00")).label(
                    "rev"
                ),
            )
            .where(RevenueGeneratorEntry.revenue_generator_item_id.in_(item_ids))
            .group_by(RevenueGeneratorEntry.revenue_generator_item_id)
        )
        result = await db.execute(stmt)
        return {row.revenue_generator_item_id: (row.cnt, row.rev) for row in result}

    @staticmethod
    async def _get_current_winner_bulk(
        db: AsyncSession, item_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[str, int]]:
        """Bulk version of _get_current_winner to avoid N+1 queries."""
        if not item_ids:
            return {}
        from sqlalchemy import and_

        sub = (
            select(
                RevenueGeneratorWinnerSelection.revenue_generator_item_id,
                func.max(RevenueGeneratorWinnerSelection.selected_at).label("max_at"),
            )
            .where(RevenueGeneratorWinnerSelection.revenue_generator_item_id.in_(item_ids))
            .group_by(RevenueGeneratorWinnerSelection.revenue_generator_item_id)
            .subquery()
        )
        stmt = select(RevenueGeneratorWinnerSelection).join(
            sub,
            and_(
                RevenueGeneratorWinnerSelection.revenue_generator_item_id
                == sub.c.revenue_generator_item_id,
                RevenueGeneratorWinnerSelection.selected_at == sub.c.max_at,
            ),
        )
        result = await db.execute(stmt)
        return {
            ws.revenue_generator_item_id: (ws.winner_name, ws.bidder_number)
            for ws in result.scalars().all()
        }

    @staticmethod
    async def _get_guest_name(db: AsyncSession, guest_id: uuid.UUID | None) -> str | None:
        if not guest_id:
            return None
        result = await db.execute(select(RegistrationGuest).where(RegistrationGuest.id == guest_id))
        guest = result.scalar_one_or_none()
        if not guest:
            return None
        if guest.name:
            return guest.name
        return None

    @staticmethod
    async def _get_my_entry_count(
        db: AsyncSession, item_id: uuid.UUID, donor_user_id: uuid.UUID
    ) -> int:
        # Find registration guests for this user
        from app.models.event_registration import EventRegistration

        reg_stmt = (
            select(RegistrationGuest.id)
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(EventRegistration.user_id == donor_user_id)
        )
        reg_result = await db.execute(reg_stmt)
        guest_ids = [r[0] for r in reg_result.all()]
        if not guest_ids:
            return 0
        count_stmt = select(func.count()).where(
            RevenueGeneratorEntry.revenue_generator_item_id == item_id,
            RevenueGeneratorEntry.registration_guest_id.in_(guest_ids),
        )
        count_result = await db.execute(count_stmt)
        return count_result.scalar_one() or 0
