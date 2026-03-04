"""Tests for the event duplication feature (031-duplicate-event).

Covers service-level logic (EventService.duplicate_event) and the
POST /api/v1/events/{event_id}/duplicate API endpoint.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.donation_label import DonationLabel
from app.models.event import (
    Event,
    EventLink,
    EventLinkType,
    EventMedia,
    EventMediaStatus,
    EventMediaType,
    EventMediaUsageTag,
    EventStatus,
    FoodOption,
)
from app.models.event_table import EventTable
from app.models.sponsor import Sponsor
from app.models.ticket_management import CustomTicketOption, TicketPackage

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_source_event(
    db: AsyncSession,
    npo_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    name: str = "Charity Gala 2025",
    with_food: bool = True,
    with_tickets: bool = True,
    with_tables: bool = True,
    with_sponsors: bool = True,
    with_media: bool = True,
    with_links: bool = True,
    with_donation_labels: bool = True,
) -> Event:
    """Create a fully-populated source event for duplication tests."""
    event = Event(
        npo_id=npo_id,
        name=name,
        slug=f"charity-gala-{uuid.uuid4().hex[:8]}",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/New_York",
        venue_name="Grand Ballroom",
        venue_address="789 Gala Ave, New York, NY 10001",
        venue_city="New York",
        venue_state="NY",
        venue_zip="10001",
        attire="Black Tie",
        fundraising_goal=50000.0,
        primary_contact_name="John Doe",
        primary_contact_email="john@example.com",
        primary_contact_phone="+1-555-0100",
        description="Annual charity gala event",
        logo_url="https://example.com/logo.png",
        primary_color="#1a73e8",
        secondary_color="#34a853",
        background_color="#ffffff",
        accent_color="#fbbc04",
        table_count=10,
        max_guests_per_table=8,
        seating_layout_image_url=None,
        version=3,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(event)
    await db.flush()

    if with_food:
        db.add(
            FoodOption(event_id=event.id, name="Steak", description="8oz ribeye", display_order=1)
        )
        db.add(
            FoodOption(event_id=event.id, name="Fish", description="Salmon filet", display_order=2)
        )

    if with_tickets:
        tp = TicketPackage(
            event_id=event.id,
            created_by=user_id,
            name="VIP Table",
            description="Premium seating",
            price=500.0,
            seats_per_package=8,
            quantity_limit=10,
            sold_count=5,
            display_order=1,
            is_enabled=True,
            is_sponsorship=False,
            version=1,
        )
        db.add(tp)
        await db.flush()

        db.add(
            CustomTicketOption(
                ticket_package_id=tp.id,
                option_label="Dietary Preference",
                option_type="multi_select",
                choices=["Standard", "Vegetarian", "Vegan"],
                is_required=True,
                display_order=1,
            )
        )

    if with_tables:
        db.add(
            EventTable(
                event_id=event.id,
                table_number=1,
                custom_capacity=10,
                table_name="VIP Table",
                table_captain_id=None,  # FK to registration_guests; skip in tests
            )
        )
        db.add(
            EventTable(
                event_id=event.id,
                table_number=2,
                custom_capacity=8,
                table_name=None,
                table_captain_id=None,
            )
        )

    if with_sponsors:
        db.add(
            Sponsor(
                event_id=event.id,
                created_by=user_id,
                name="ACME Corp",
                logo_url="https://blob.example.com/acme-logo.png",
                logo_blob_name="sponsors/acme-logo.png",
                thumbnail_url="https://blob.example.com/acme-thumb.png",
                thumbnail_blob_name="sponsors/acme-thumb.png",
                logo_size="medium",
                display_order=1,
                sponsor_level="Gold",
                website_url="https://acme.example.com",
                donation_amount=10000.0,
            )
        )

    if with_media:
        db.add(
            EventMedia(
                event_id=event.id,
                media_type=EventMediaType.IMAGE,
                usage_tag=EventMediaUsageTag.MAIN_EVENT_PAGE_HERO,
                file_url="https://blob.example.com/events/hero.jpg",
                file_name="hero.jpg",
                file_type="image/jpeg",
                mime_type="image/jpeg",
                blob_name=f"events/{event.id}/hero.jpg",
                file_size=1024000,
                display_order=1,
                status=EventMediaStatus.SCANNED,
                uploaded_by=user_id,
            )
        )

    if with_links:
        db.add(
            EventLink(
                event_id=event.id,
                link_type=EventLinkType.WEBSITE,
                url="https://example.com/event",
                label="Event Website",
                display_order=1,
                created_by=user_id,
            )
        )

    if with_donation_labels:
        db.add(
            DonationLabel(
                event_id=event.id,
                name="General Fund",
                is_active=True,
            )
        )
        db.add(
            DonationLabel(
                event_id=event.id,
                name="Building Fund",
                is_active=True,
            )
        )

    await db.commit()

    # Re-query with all relationships loaded
    result = await db.execute(
        select(Event)
        .where(Event.id == event.id)
        .options(
            selectinload(Event.food_options),
            selectinload(Event.ticket_packages).selectinload(TicketPackage.custom_options),
            selectinload(Event.tables),
            selectinload(Event.sponsors),
            selectinload(Event.media),
            selectinload(Event.links),
            selectinload(Event.donation_labels),
            selectinload(Event.npo),
        )
    )
    return result.scalar_one()


async def _load_event_with_rels(db: AsyncSession, event_id: uuid.UUID) -> Event:
    """Reload an event with all relationships."""
    result = await db.execute(
        select(Event)
        .where(Event.id == event_id)
        .options(
            selectinload(Event.food_options),
            selectinload(Event.ticket_packages).selectinload(TicketPackage.custom_options),
            selectinload(Event.tables),
            selectinload(Event.sponsors),
            selectinload(Event.media),
            selectinload(Event.links),
            selectinload(Event.donation_labels),
            selectinload(Event.npo),
        )
    )
    return result.scalar_one()


# ===========================================================================
# Service-level tests
# ===========================================================================


@pytest.mark.asyncio
class TestDuplicateEventService:
    """Test EventService.duplicate_event core logic."""

    async def test_duplicate_creates_draft_event(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Duplicated event has DRAFT status and version=1."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.status == EventStatus.DRAFT
        assert new_event.version == 1

    async def test_duplicate_name_has_copy_suffix(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Clone name is '{original} (Copy)'."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.name == f"{source.name} (Copy)"

    async def test_duplicate_generates_unique_slug(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Clone gets a unique slug distinct from the source."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.slug != source.slug
        assert new_event.slug  # non-empty

    async def test_duplicate_preserves_npo_id(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Clone belongs to the same NPO as the source."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.npo_id == source.npo_id

    async def test_duplicate_copies_event_details(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Key event detail fields are carried over from source."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.timezone == source.timezone
        assert new_event.venue_name == source.venue_name
        assert new_event.venue_address == source.venue_address
        assert new_event.venue_city == source.venue_city
        assert new_event.venue_state == source.venue_state
        assert new_event.venue_zip == source.venue_zip
        assert new_event.attire == source.attire
        assert new_event.fundraising_goal == source.fundraising_goal
        assert new_event.description == source.description
        assert new_event.primary_color == source.primary_color
        assert new_event.secondary_color == source.secondary_color
        assert new_event.logo_url == source.logo_url

    async def test_duplicate_resets_seating_layout(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Seating layout image URL is NULL on clone (no deep-copy by default)."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.seating_layout_image_url is None

    async def test_duplicate_sets_created_by(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """created_by and updated_by reflect the duplicating user."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.created_by == test_npo_admin_user.id
        assert new_event.updated_by == test_npo_admin_user.id

    async def test_duplicate_has_new_id(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Clone gets a brand new UUID."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert new_event.id != source.id

    # --- Food options ---

    async def test_duplicate_clones_food_options(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Food options are always cloned."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.food_options) == 2
        food_names = {fo.name for fo in loaded.food_options}
        assert food_names == {"Steak", "Fish"}
        # Ensure they belong to the new event
        for fo in loaded.food_options:
            assert fo.event_id == new_event.id

    # --- Ticket packages ---

    async def test_duplicate_clones_ticket_packages(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Ticket packages are always cloned with sold_count=0."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.ticket_packages) == 1
        tp = loaded.ticket_packages[0]
        assert tp.name == "VIP Table"
        assert tp.sold_count == 0
        assert tp.price == 500.0
        assert tp.event_id == new_event.id

    async def test_duplicate_clones_custom_ticket_options(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Custom ticket options on ticket packages are also cloned."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        tp = loaded.ticket_packages[0]
        assert len(tp.custom_options) == 1
        cto = tp.custom_options[0]
        assert cto.option_label == "Dietary Preference"
        assert cto.is_required is True

    # --- Tables ---

    async def test_duplicate_clones_tables_without_captain(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Event tables are cloned but table_captain_id is set to None."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.tables) == 2
        for t in loaded.tables:
            assert t.table_captain_id is None
            assert t.event_id == new_event.id

        table_map = {t.table_number: t for t in loaded.tables}
        assert table_map[1].custom_capacity == 10
        assert table_map[1].table_name == "VIP Table"
        assert table_map[2].custom_capacity == 8

    # --- Sponsors ---

    async def test_duplicate_clones_sponsors(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Sponsors are always cloned with shared logo refs."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.sponsors) == 1
        sp = loaded.sponsors[0]
        assert sp.name == "ACME Corp"
        assert sp.logo_blob_name == "sponsors/acme-logo.png"
        assert sp.donation_amount == 10000.0
        assert sp.event_id == new_event.id

    # --- Media (conditional) ---

    async def test_duplicate_excludes_media_by_default(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """With default options, media is NOT cloned."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.schemas.event import DuplicateEventRequest
        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(
            db_session,
            source.id,
            test_npo_admin_user,
            DuplicateEventRequest(),  # include_media=False by default
        )

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.media) == 0

    async def test_duplicate_includes_media_when_requested(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """With include_media=True, media is cloned with a deep-copy."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.schemas.event import DuplicateEventRequest
        from app.services.event_service import EventService

        with patch(
            "app.services.media_service.MediaService.copy_blob", new_callable=AsyncMock
        ) as mock_copy:
            mock_copy.return_value = "https://blob.example.com/events/new/hero.jpg"

            new_event = await EventService.duplicate_event(
                db_session,
                source.id,
                test_npo_admin_user,
                DuplicateEventRequest(include_media=True),
            )

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.media) == 1
        media = loaded.media[0]
        assert media.event_id == new_event.id
        assert media.file_name == "hero.jpg"
        assert media.media_type == "image"
        assert media.uploaded_by == test_npo_admin_user.id
        # blob_name should reference the new event
        assert str(new_event.id) in media.blob_name

    async def test_duplicate_media_deep_copy_calls_copy_blob(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """copy_blob is called once per source media file."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.schemas.event import DuplicateEventRequest
        from app.services.event_service import EventService

        with patch(
            "app.services.media_service.MediaService.copy_blob", new_callable=AsyncMock
        ) as mock_copy:
            mock_copy.return_value = "https://blob.example.com/copied.jpg"

            await EventService.duplicate_event(
                db_session,
                source.id,
                test_npo_admin_user,
                DuplicateEventRequest(include_media=True),
            )

        # Should have been called for each media item in source
        assert mock_copy.call_count == 1
        call_args = mock_copy.call_args
        assert call_args[0][0] == f"events/{source.id}/hero.jpg"  # source blob
        assert "hero.jpg" in call_args[0][1]  # target blob includes filename

    async def test_duplicate_media_copy_failure_skips_item(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """If copy_blob raises, that media item is skipped (not fatal)."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.schemas.event import DuplicateEventRequest
        from app.services.event_service import EventService

        with patch(
            "app.services.media_service.MediaService.copy_blob", new_callable=AsyncMock
        ) as mock_copy:
            mock_copy.side_effect = RuntimeError("blob storage unavailable")

            new_event = await EventService.duplicate_event(
                db_session,
                source.id,
                test_npo_admin_user,
                DuplicateEventRequest(include_media=True),
            )

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.media) == 0  # skipped due to failure

    # --- Links (conditional) ---

    async def test_duplicate_includes_links_by_default(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Links are included by default."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.links) == 1
        link = loaded.links[0]
        assert link.url == "https://example.com/event"
        assert link.event_id == new_event.id

    async def test_duplicate_excludes_links_when_disabled(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """With include_links=False, links are not cloned."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.schemas.event import DuplicateEventRequest
        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(
            db_session,
            source.id,
            test_npo_admin_user,
            DuplicateEventRequest(include_links=False),
        )

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.links) == 0

    # --- Donation labels (conditional) ---

    async def test_duplicate_includes_donation_labels_by_default(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Donation labels are included by default."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.donation_labels) == 2
        label_names = {dl.name for dl in loaded.donation_labels}
        assert label_names == {"General Fund", "Building Fund"}
        for dl in loaded.donation_labels:
            assert dl.event_id == new_event.id
            assert dl.retired_at is None  # Reset

    async def test_duplicate_excludes_donation_labels_when_disabled(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """With include_donation_labels=False, labels are not cloned."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        from app.schemas.event import DuplicateEventRequest
        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(
            db_session,
            source.id,
            test_npo_admin_user,
            DuplicateEventRequest(include_donation_labels=False),
        )

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert len(loaded.donation_labels) == 0

    # --- Edge cases ---

    async def test_duplicate_nonexistent_event_404(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Attempting to duplicate a non-existent event raises 404."""
        from fastapi import HTTPException

        from app.services.event_service import EventService

        fake_id = uuid.uuid4()
        with pytest.raises(HTTPException) as exc_info:
            await EventService.duplicate_event(db_session, fake_id, test_npo_admin_user)
        assert exc_info.value.status_code == 404

    async def test_duplicate_long_name_truncates(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """If original name + ' (Copy)' exceeds 255 chars, it is truncated."""
        long_name = "A" * 250
        source = await _create_source_event(
            db_session,
            test_approved_npo.id,
            test_npo_admin_user.id,
            name=long_name,
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        assert len(new_event.name) <= 255

    async def test_duplicate_with_no_children(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Duplicating a minimal event (no children) succeeds."""
        source = await _create_source_event(
            db_session,
            test_approved_npo.id,
            test_npo_admin_user.id,
            with_food=False,
            with_tickets=False,
            with_tables=False,
            with_sponsors=False,
            with_media=False,
            with_links=False,
            with_donation_labels=False,
        )

        from app.services.event_service import EventService

        new_event = await EventService.duplicate_event(db_session, source.id, test_npo_admin_user)

        loaded = await _load_event_with_rels(db_session, new_event.id)
        assert loaded.status == EventStatus.DRAFT
        assert len(loaded.food_options) == 0
        assert len(loaded.ticket_packages) == 0
        assert len(loaded.tables) == 0
        assert len(loaded.sponsors) == 0
        assert len(loaded.media) == 0
        assert len(loaded.links) == 0
        assert len(loaded.donation_labels) == 0


# ===========================================================================
# API endpoint tests
# ===========================================================================


@pytest.mark.asyncio
class TestDuplicateEventAPI:
    """Test POST /api/v1/events/{event_id}/duplicate endpoint."""

    async def test_duplicate_returns_201(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Successful duplication returns 201 with event detail."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        response = await npo_admin_client.post(
            f"/api/v1/events/{source.id}/duplicate",
        )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["name"] == f"{source.name} (Copy)"
        assert data["npo_id"] == str(source.npo_id)
        assert data["id"] != str(source.id)

    async def test_duplicate_with_options_body(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Can pass explicit options in the request body."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        response = await npo_admin_client.post(
            f"/api/v1/events/{source.id}/duplicate",
            json={
                "include_media": False,
                "include_links": False,
                "include_donation_labels": False,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        # Links and donation_labels should be excluded — check at DB level
        new_event = await _load_event_with_rels(db_session, uuid.UUID(data["id"]))
        assert len(new_event.links) == 0
        assert len(new_event.donation_labels) == 0

    async def test_duplicate_nonexistent_returns_404(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Requesting duplication of a non-existent event returns 404."""
        fake_id = uuid.uuid4()
        response = await npo_admin_client.post(
            f"/api/v1/events/{fake_id}/duplicate",
        )

        assert response.status_code == 404

    async def test_duplicate_by_donor_returns_403(
        self,
        donor_client: AsyncClient,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Donor users cannot duplicate events (403)."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        response = await donor_client.post(
            f"/api/v1/events/{source.id}/duplicate",
        )

        assert response.status_code == 403

    async def test_duplicate_unauthenticated_returns_401(
        self,
        async_client: AsyncClient,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Unauthenticated requests return 401."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        response = await async_client.post(
            f"/api/v1/events/{source.id}/duplicate",
        )

        assert response.status_code == 401

    async def test_duplicate_by_super_admin_succeeds(
        self,
        super_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Super admins can duplicate any event."""
        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        response = await super_admin_client.post(
            f"/api/v1/events/{source.id}/duplicate",
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == f"{source.name} (Copy)"

    async def test_duplicate_creates_audit_log(
        self,
        npo_admin_client: AsyncClient,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
        db_session: AsyncSession,
    ) -> None:
        """Duplication creates an audit log entry."""
        from app.models.audit_log import AuditLog

        source = await _create_source_event(
            db_session, test_approved_npo.id, test_npo_admin_user.id
        )

        response = await npo_admin_client.post(
            f"/api/v1/events/{source.id}/duplicate",
        )
        assert response.status_code == 201

        data = response.json()
        new_event_id = uuid.UUID(data["id"])

        # Check audit log
        result = await db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "event_duplicated",
                AuditLog.resource_id == new_event_id,
            )
        )
        audit = result.scalar_one_or_none()
        assert audit is not None
        assert audit.event_metadata["source_event_id"] == str(source.id)
        assert audit.event_metadata["new_event_id"] == str(new_event_id)
