"""Contract tests for Event Registration Branding API endpoints.

Tests the /registrations/events-with-branding endpoint that returns
events a user is registered for with resolved branding colors.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration, RegistrationStatus
from app.models.npo_branding import NPOBranding

# ================================
# Test-specific Fixtures
# ================================


@pytest_asyncio.fixture
async def event_with_custom_colors(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Event:
    """Create an ACTIVE event with custom branding colors."""
    event = Event(
        npo_id=test_approved_npo.id,
        name="Custom Branded Event",
        slug="custom-branded-event",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=15),
        timezone="America/New_York",
        venue_name="Custom Venue",
        venue_address="123 Custom St",
        description="Event with custom branding colors",
        logo_url="https://example.com/event-logo.png",
        primary_color="#FF0000",  # Red
        secondary_color="#00FF00",  # Green
        background_color="#0000FF",  # Blue
        accent_color="#FFFF00",  # Yellow
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest_asyncio.fixture
async def event_without_colors(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Event:
    """Create an ACTIVE event without branding colors (should fall back to NPO)."""
    event = Event(
        npo_id=test_approved_npo.id,
        name="No Branding Event",
        slug="no-branding-event",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=20),
        timezone="America/New_York",
        venue_name="Default Venue",
        venue_address="456 Default St",
        description="Event without custom branding",
        # No color fields set - should use defaults
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest_asyncio.fixture
async def upcoming_event(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Event:
    """Create an upcoming event (in 10 days)."""
    event = Event(
        npo_id=test_approved_npo.id,
        name="Upcoming Event",
        slug="upcoming-event",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=10),
        timezone="America/New_York",
        venue_name="Upcoming Venue",
        venue_address="789 Upcoming St",
        description="An upcoming event",
        primary_color="#111111",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest_asyncio.fixture
async def future_event(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Event:
    """Create a future event (in 45 days - not within 30-day 'upcoming' window)."""
    event = Event(
        npo_id=test_approved_npo.id,
        name="Future Event",
        slug="future-event",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) + timedelta(days=45),
        timezone="America/New_York",
        venue_name="Future Venue",
        venue_address="101 Future St",
        description="A future event beyond 30 days",
        primary_color="#222222",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest_asyncio.fixture
async def past_event(
    db_session: AsyncSession, test_approved_npo: Any, test_npo_admin_user: Any
) -> Event:
    """Create a past event (5 days ago)."""
    event = Event(
        npo_id=test_approved_npo.id,
        name="Past Event",
        slug="past-event",
        status=EventStatus.ACTIVE,
        event_datetime=datetime.now(UTC) - timedelta(days=5),
        timezone="America/New_York",
        venue_name="Past Venue",
        venue_address="999 Past St",
        description="A past event",
        primary_color="#333333",
        version=1,
        created_by=test_npo_admin_user.id,
        updated_by=test_npo_admin_user.id,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest_asyncio.fixture
async def npo_branding_with_colors(db_session: AsyncSession, test_approved_npo: Any) -> NPOBranding:
    """Create NPO branding with custom colors for fallback testing."""
    branding = NPOBranding(
        npo_id=test_approved_npo.id,
        primary_color="#AA0000",  # Dark red
        secondary_color="#00AA00",  # Dark green
        background_color="#0000AA",  # Dark blue
        accent_color="#AAAA00",  # Olive
        logo_url="https://example.com/npo-logo.png",
    )
    db_session.add(branding)
    await db_session.commit()
    await db_session.refresh(branding)
    return branding


async def create_registration(
    db_session: AsyncSession,
    user_id: Any,
    event_id: Any,
    status: RegistrationStatus = RegistrationStatus.CONFIRMED,
) -> EventRegistration:
    """Helper to create an event registration."""
    registration = EventRegistration(
        user_id=user_id,
        event_id=event_id,
        number_of_guests=0,
        status=status,
    )
    db_session.add(registration)
    await db_session.commit()
    await db_session.refresh(registration)
    return registration


# ================================
# Contract Tests
# ================================


@pytest.mark.asyncio
class TestGetRegisteredEventsWithBrandingContract:
    """Contract tests for GET /api/v1/registrations/events-with-branding endpoint."""

    async def test_get_registered_events_with_branding_empty(
        self, authenticated_client: AsyncClient
    ):
        """Test returns empty list when user has no registrations."""
        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        assert len(data["events"]) == 0

    async def test_get_registered_events_with_branding_event_colors(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Any,
        event_with_custom_colors: Event,
    ):
        """Test returns event's custom colors when set."""
        # Create registration for the user
        await create_registration(db_session, test_user.id, event_with_custom_colors.id)

        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()
        assert len(data["events"]) == 1

        event = data["events"][0]
        assert event["id"] == str(event_with_custom_colors.id)
        assert event["name"] == "Custom Branded Event"
        assert event["slug"] == "custom-branded-event"
        assert event["primary_color"] == "#FF0000"
        assert event["secondary_color"] == "#00FF00"
        assert event["background_color"] == "#0000FF"
        assert event["accent_color"] == "#FFFF00"
        assert event["is_past"] is False
        assert "is_upcoming" in event
        assert "thumbnail_url" in event
        assert "npo_name" in event

    async def test_get_registered_events_with_branding_npo_fallback(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Any,
        event_without_colors: Event,
        npo_branding_with_colors: NPOBranding,
    ):
        """Test falls back to NPO colors when event has no colors."""
        # Create registration for the user
        await create_registration(db_session, test_user.id, event_without_colors.id)

        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()
        assert len(data["events"]) == 1

        event = data["events"][0]
        # Should use NPO branding colors as fallback
        assert event["primary_color"] == "#AA0000"
        assert event["secondary_color"] == "#00AA00"
        assert event["background_color"] == "#0000AA"
        assert event["accent_color"] == "#AAAA00"
        assert event["npo_logo_url"] == "https://example.com/npo-logo.png"

    async def test_get_registered_events_with_branding_system_defaults(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Any,
        event_without_colors: Event,
    ):
        """Test uses system defaults when neither event nor NPO has colors."""
        # No NPO branding fixture - should use system defaults
        await create_registration(db_session, test_user.id, event_without_colors.id)

        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()
        assert len(data["events"]) == 1

        event = data["events"][0]
        # Should use system default colors
        assert event["primary_color"] == "#3B82F6"
        assert event["secondary_color"] == "#9333EA"
        assert event["background_color"] == "#FFFFFF"
        assert event["accent_color"] == "#3B82F6"

    async def test_get_registered_events_sorted_correctly(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Any,
        upcoming_event: Event,
        future_event: Event,
        past_event: Event,
    ):
        """Test events are sorted: upcoming first (ascending), then past (descending)."""
        # Register for all three events
        await create_registration(db_session, test_user.id, upcoming_event.id)
        await create_registration(db_session, test_user.id, future_event.id)
        await create_registration(db_session, test_user.id, past_event.id)

        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()
        assert len(data["events"]) == 3

        # First should be upcoming_event (10 days from now)
        assert data["events"][0]["name"] == "Upcoming Event"
        assert data["events"][0]["is_past"] is False
        assert data["events"][0]["is_upcoming"] is True

        # Second should be future_event (45 days from now)
        assert data["events"][1]["name"] == "Future Event"
        assert data["events"][1]["is_past"] is False
        assert data["events"][1]["is_upcoming"] is False

        # Third should be past_event (5 days ago)
        assert data["events"][2]["name"] == "Past Event"
        assert data["events"][2]["is_past"] is True
        assert data["events"][2]["is_upcoming"] is False

    async def test_get_registered_events_excludes_cancelled(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Any,
        event_with_custom_colors: Event,
        event_without_colors: Event,
    ):
        """Test cancelled registrations are not returned."""
        # Create confirmed registration
        await create_registration(
            db_session,
            test_user.id,
            event_with_custom_colors.id,
            status=RegistrationStatus.CONFIRMED,
        )
        # Create cancelled registration
        await create_registration(
            db_session, test_user.id, event_without_colors.id, status=RegistrationStatus.CANCELLED
        )

        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()
        # Should only return the confirmed registration
        assert len(data["events"]) == 1
        assert data["events"][0]["name"] == "Custom Branded Event"

    async def test_get_registered_events_unauthenticated_returns_401(
        self, async_client: AsyncClient
    ):
        """Test unauthenticated access returns 401."""
        response = await async_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 401

    async def test_get_registered_events_response_schema(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        test_user: Any,
        event_with_custom_colors: Event,
    ):
        """Test response adheres to expected schema."""
        await create_registration(db_session, test_user.id, event_with_custom_colors.id)

        response = await authenticated_client.get("/api/v1/registrations/events-with-branding")

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "events" in data

        # Check event schema
        event = data["events"][0]
        required_fields = [
            "id",
            "name",
            "slug",
            "event_datetime",
            "timezone",
            "is_past",
            "is_upcoming",
            "thumbnail_url",
            "primary_color",
            "secondary_color",
            "background_color",
            "accent_color",
            "npo_name",
            "npo_logo_url",
        ]
        for field in required_fields:
            assert field in event, f"Missing required field: {field}"

        # Validate UUID format
        import uuid

        try:
            uuid.UUID(event["id"])
        except ValueError:
            pytest.fail("id is not a valid UUID")

        # Validate datetime format
        assert "T" in event["event_datetime"]  # ISO format

        # Validate color format
        assert event["primary_color"].startswith("#")
        assert len(event["primary_color"]) == 7
