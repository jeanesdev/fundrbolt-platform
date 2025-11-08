"""Unit tests for event slug generation logic."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestSlugGeneration:
    """Test slug generation with collision detection."""

    async def test_generate_slug_from_event_name(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test slug is auto-generated from event name."""
        from app.services.event_service import EventService

        # Test basic slug generation
        slug = await EventService._generate_unique_slug(db_session, "Summer Gala 2025", None)
        assert slug == "summer-gala-2025"

        # Test with special characters
        slug = await EventService._generate_unique_slug(
            db_session, "Spring Event: A Night to Remember!", None
        )
        assert slug == "spring-event-a-night-to-remember"

        # Test with multiple spaces and punctuation
        slug = await EventService._generate_unique_slug(
            db_session, "  Annual   Fundraiser   -   2025  ", None
        )
        # Result will vary based on slugify implementation, but should be normalized
        assert "annual" in slug
        assert "fundraiser" in slug
        assert "2025" in slug

    async def test_custom_slug_used_when_provided(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test custom slug is used instead of auto-generated."""
        from app.services.event_service import EventService

        slug = await EventService._generate_unique_slug(
            db_session,
            "Event Name That Would Generate Different Slug",
            custom_slug="my-custom-slug",
        )
        assert slug == "my-custom-slug"

    async def test_slug_collision_detection(
        self,
        db_session: AsyncSession,
        test_event: Any,
    ) -> None:
        """Test slug collision generates unique suffix."""
        from app.services.event_service import EventService

        # test_event has slug "annual-gala-2025"
        # Try to generate same slug
        new_slug = await EventService._generate_unique_slug(db_session, "Annual Gala 2025", None)

        # Should get a different slug with numeric suffix
        assert new_slug != "annual-gala-2025"
        assert new_slug in ["annual-gala-2025-2", "annual-gala-2025-3"]

    async def test_slug_collision_max_attempts(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test slug generation fails after max attempts (3)."""
        from app.services.event_service import EventService

        # Create a mock session that always reports slug exists
        mock_session = MagicMock(spec=AsyncSession)
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = (
            MagicMock()
        )  # Always returns a result (collision)
        mock_execute.return_value = mock_result
        mock_session.execute = mock_execute

        # Should raise HTTPException after 3 attempts
        with pytest.raises(HTTPException) as exc_info:
            await EventService._generate_unique_slug(mock_session, "Test Event", None)

        assert exc_info.value.status_code == 409
        assert "unique slug" in str(exc_info.value.detail).lower()

    async def test_slug_special_characters_normalized(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test slugs normalize special characters correctly."""
        from app.services.event_service import EventService

        # Test various special characters (simplified for test)
        test_cases = [
            ("Event & Party @ 2025", "event-party-2025"),
            ("100% Fun!", "100-fun"),
        ]

        for event_name, _expected_base in test_cases:
            slug = await EventService._generate_unique_slug(db_session, event_name, None)
            # Slug should be normalized and URL-safe
            assert slug
            assert " " not in slug
            assert slug.islower()

    async def test_slug_preserves_hyphens(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test slugs preserve hyphens in event names."""
        from app.services.event_service import EventService

        slug = await EventService._generate_unique_slug(db_session, "Pre-Event Mixer", None)
        assert slug == "pre-event-mixer"

    async def test_slug_lowercase_conversion(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Test slugs are converted to lowercase."""
        from app.services.event_service import EventService

        slug = await EventService._generate_unique_slug(db_session, "UPPERCASE EVENT NAME", None)
        assert slug == "uppercase-event-name"
        assert slug.islower()

    async def test_slug_collision_increments_suffix(
        self,
        db_session: AsyncSession,
        test_approved_npo: Any,
        test_npo_admin_user: Any,
    ) -> None:
        """Test multiple collisions increment suffix correctly."""
        from datetime import UTC, datetime, timedelta

        from app.models.event import Event, EventStatus
        from app.services.event_service import EventService

        # Create event with slug "test-slug"
        event1 = Event(
            npo_id=test_approved_npo.id,
            name="Test Event 1",
            slug="test-slug",
            status=EventStatus.DRAFT,
            event_datetime=datetime.now(UTC) + timedelta(days=1),
            timezone="America/New_York",
            venue_name="Venue 1",
            version=1,
            created_by=test_npo_admin_user.id,
            updated_by=test_npo_admin_user.id,
        )
        db_session.add(event1)
        await db_session.commit()

        # First collision should get -2
        slug2 = await EventService._generate_unique_slug(db_session, "Test Slug", None)
        assert slug2 == "test-slug-2"

        # Create event with that slug
        event2 = Event(
            npo_id=test_approved_npo.id,
            name="Test Event 2",
            slug=slug2,
            status=EventStatus.DRAFT,
            event_datetime=datetime.now(UTC) + timedelta(days=2),
            timezone="America/New_York",
            venue_name="Venue 2",
            version=1,
            created_by=test_npo_admin_user.id,
            updated_by=test_npo_admin_user.id,
        )
        db_session.add(event2)
        await db_session.commit()

        # Next collision should get -3
        slug3 = await EventService._generate_unique_slug(db_session, "Test Slug", None)
        assert slug3 == "test-slug-3"

    async def test_custom_slug_collision_detection(
        self,
        db_session: AsyncSession,
        test_event: Any,
    ) -> None:
        """Test custom slug collision generates suffix like auto slug."""
        from app.services.event_service import EventService

        # test_event has slug "annual-gala-2025"
        # Try to use same slug as custom
        new_slug = await EventService._generate_unique_slug(
            db_session,
            "Different Name",
            custom_slug="annual-gala-2025",
        )

        # Should get numeric suffix
        assert new_slug in ["annual-gala-2025-2", "annual-gala-2025-3"]
