"""Contract tests for GET /api/v1/events/{event_id}/stats."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEventStats:
    """Test suite for the event stats endpoint."""

    async def test_get_event_stats_success(
        self,
        npo_admin_client: AsyncClient,
        db_session: AsyncSession,
        test_event: Any,
        test_npo_admin_user: Any,
        test_donor_user: Any,
    ) -> None:
        """Ensure stats endpoint returns correct aggregate counts."""
        from app.models.auction_item import AuctionItem, AuctionType
        from app.models.event import (
            EventLink,
            EventLinkType,
            EventMedia,
            EventMediaStatus,
            EventMediaType,
            FoodOption,
        )
        from app.models.event_registration import EventRegistration, RegistrationStatus
        from app.models.registration_guest import RegistrationGuest
        from app.models.sponsor import LogoSize, Sponsor

        media = EventMedia(
            event_id=test_event.id,
            media_type=EventMediaType.IMAGE,
            file_url="https://storage.test/events/media.jpg",
            file_name="media.jpg",
            file_type="image/jpeg",
            mime_type="image/jpeg",
            blob_name="event-media/media.jpg",
            file_size=1024,
            display_order=0,
            status=EventMediaStatus.SCANNED,
            uploaded_by=test_npo_admin_user.id,
        )
        link = EventLink(
            event_id=test_event.id,
            link_type=EventLinkType.VIDEO,
            url="https://youtu.be/example",
            label="Promo",
            platform="YouTube",
            display_order=0,
            created_by=test_npo_admin_user.id,
        )
        food_option = FoodOption(
            event_id=test_event.id,
            name="Vegetarian",
            description="Veg option",
            display_order=0,
        )
        sponsor = Sponsor(
            event_id=test_event.id,
            created_by=test_npo_admin_user.id,
            name="Acme Corp",
            logo_url="https://storage.test/logo.png",
            logo_blob_name="logos/acme.png",
            thumbnail_url="https://storage.test/logo-thumb.png",
            thumbnail_blob_name="logos/acme-thumb.png",
            logo_size=LogoSize.MEDIUM.value,
            display_order=0,
        )
        auction_item = AuctionItem(
            event_id=test_event.id,
            sponsor_id=sponsor.id,
            created_by=test_npo_admin_user.id,
            bid_number=101,
            title="Weekend Getaway",
            description="Two-night stay at a resort",
            auction_type=AuctionType.LIVE.value,
            starting_bid=Decimal("100.00"),
            donor_value=Decimal("250.00"),
            quantity_available=1,
        )
        registration = EventRegistration(
            event_id=test_event.id,
            user_id=test_donor_user.id,
            status=RegistrationStatus.CONFIRMED,
            number_of_guests=2,
        )

        db_session.add_all([media, link, food_option, sponsor, auction_item, registration])
        await db_session.flush()

        guest_one = RegistrationGuest(
            registration_id=registration.id,
            name="Guest One",
            email="guest1@example.com",
        )
        guest_two = RegistrationGuest(
            registration_id=registration.id,
            name="Guest Two",
            email="guest2@example.com",
        )
        db_session.add_all([guest_one, guest_two])
        await db_session.commit()

        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == str(test_event.id)
        assert data["media_count"] == 1
        assert data["links_count"] == 1
        assert data["food_options_count"] == 1
        assert data["sponsors_count"] == 1
        assert data["auction_items_count"] == 1
        assert data["auction_bids_count"] == 0
        assert data["registrations_count"] == 1
        assert data["active_registrations_count"] == 1
        assert data["guest_count"] == 2
        assert data["active_guest_count"] == 2

    async def test_get_event_stats_forbidden_for_donor(
        self,
        donor_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Donor role should receive 403 when requesting stats."""
        response = await donor_client.get(f"/api/v1/events/{test_event.id}/stats")

        assert response.status_code == 403

    async def test_get_event_stats_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Unknown event ID should return 404."""
        response = await npo_admin_client.get(f"/api/v1/events/{uuid.uuid4()}/stats")

        assert response.status_code == 404
