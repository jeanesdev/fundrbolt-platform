"""Tests for SponsorService."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.sponsor import LogoSize
from app.models.user import User
from app.schemas.sponsor import SponsorCreate
from app.services.sponsor_service import SponsorService


@pytest.mark.asyncio
class TestSponsorService:
    """Test SponsorService methods."""

    async def test_create_sponsor_with_unique_name(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test creating a sponsor with a unique name succeeds."""
        # Arrange
        data = SponsorCreate(
            name="Unique Sponsor Corp",
            logo_size=LogoSize.LARGE,
            logo_file_name="logo.png",
            logo_file_type="image/png",
            logo_file_size=50000,
        )

        # Act
        sponsor = await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

        # Assert
        assert sponsor.name == "Unique Sponsor Corp"
        assert sponsor.logo_size == LogoSize.LARGE
        assert sponsor.event_id == test_event.id
        assert sponsor.created_by == test_user.id
        assert sponsor.display_order == 0  # First sponsor

    async def test_create_sponsor_rejects_duplicate_name(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test creating a sponsor with duplicate name raises HTTPException."""
        # Arrange - Create first sponsor
        data = SponsorCreate(
            name="Duplicate Name Inc",
            logo_size=LogoSize.MEDIUM,
            logo_file_name="logo.png",
            logo_file_type="image/png",
            logo_file_size=50000,
        )
        await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

        # Act & Assert - Try to create duplicate
        from fastapi import HTTPException

        with pytest.raises(HTTPException, match="already exists"):
            await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

    async def test_get_sponsors_for_event_ordering(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test getting sponsors returns them in display_order (creation order)."""
        # Arrange - Create 3 sponsors
        for i, name in enumerate(["First Corp", "Second Inc", "Third LLC"]):
            data = SponsorCreate(
                name=name,
                logo_size=LogoSize.MEDIUM,
                logo_file_name=f"logo{i}.png",
                logo_file_type="image/png",
                logo_file_size=50000,
            )
            await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

        # Act
        sponsors = await SponsorService.get_sponsors_for_event(db_session, test_event.id)

        # Assert
        assert len(sponsors) == 3
        assert sponsors[0].name == "First Corp"
        assert sponsors[0].display_order == 0
        assert sponsors[1].name == "Second Inc"
        assert sponsors[1].display_order == 1
        assert sponsors[2].name == "Third LLC"
        assert sponsors[2].display_order == 2

    async def test_get_sponsors_for_event_empty(self, db_session: AsyncSession, test_event: Event):
        """Test getting sponsors for event with no sponsors returns empty list."""
        # Act
        sponsors = await SponsorService.get_sponsors_for_event(db_session, test_event.id)

        # Assert
        assert sponsors == []

    async def test_get_sponsor_by_id(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test getting a sponsor by ID."""
        # Arrange
        data = SponsorCreate(
            name="GetByID Corp",
            logo_size=LogoSize.SMALL,
            logo_file_name="logo.png",
            logo_file_type="image/png",
            logo_file_size=50000,
        )
        created_sponsor = await SponsorService.create_sponsor(
            db_session, test_event.id, data, test_user
        )

        # Act
        sponsor = await SponsorService.get_sponsor_by_id(
            db_session, created_sponsor.id, test_event.id
        )

        # Assert
        assert sponsor is not None
        assert sponsor.id == created_sponsor.id
        assert sponsor.name == "GetByID Corp"

    async def test_get_sponsor_by_id_not_found(self, db_session: AsyncSession, test_event: Event):
        """Test getting a sponsor by ID that doesn't exist returns None."""
        # Arrange
        import uuid

        fake_id = uuid.uuid4()

        # Act
        sponsor = await SponsorService.get_sponsor_by_id(db_session, fake_id, test_event.id)

        # Assert
        assert sponsor is None

    async def test_check_duplicate_name_true(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test check_duplicate_name returns True when name exists."""
        # Arrange
        data = SponsorCreate(
            name="Duplicate Check Corp",
            logo_size=LogoSize.LARGE,
            logo_file_name="logo.png",
            logo_file_type="image/png",
            logo_file_size=50000,
        )
        await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

        # Act
        is_duplicate = await SponsorService.check_duplicate_name(
            db_session, test_event.id, "Duplicate Check Corp"
        )

        # Assert
        assert is_duplicate is True

    async def test_check_duplicate_name_false(self, db_session: AsyncSession, test_event: Event):
        """Test check_duplicate_name returns False when name is unique."""
        # Act
        is_duplicate = await SponsorService.check_duplicate_name(
            db_session, test_event.id, "Unique Name Corp"
        )

        # Assert
        assert is_duplicate is False

    async def test_check_duplicate_name_exclude_self(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test check_duplicate_name excludes specified sponsor ID."""
        # Arrange
        data = SponsorCreate(
            name="Exclude Self Corp",
            logo_size=LogoSize.MEDIUM,
            logo_file_name="logo.png",
            logo_file_type="image/png",
            logo_file_size=50000,
        )
        sponsor = await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

        # Act - Check duplicate excluding the sponsor itself
        is_duplicate = await SponsorService.check_duplicate_name(
            db_session, test_event.id, "Exclude Self Corp", exclude_id=sponsor.id
        )

        # Assert
        assert is_duplicate is False  # Should exclude itself

    async def test_get_next_display_order(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test get_next_display_order increments correctly."""
        # Arrange - Create 2 sponsors
        for i in range(2):
            data = SponsorCreate(
                name=f"Order Test {i}",
                logo_size=LogoSize.LARGE,
                logo_file_name=f"logo{i}.png",
                logo_file_type="image/png",
                logo_file_size=50000,
            )
            await SponsorService.create_sponsor(db_session, test_event.id, data, test_user)

        # Act
        next_order = await SponsorService.get_next_display_order(db_session, test_event.id)

        # Assert
        assert next_order == 2  # 0, 1, then 2

    async def test_get_next_display_order_empty(self, db_session: AsyncSession, test_event: Event):
        """Test get_next_display_order returns 0 when no sponsors exist."""
        # Act
        next_order = await SponsorService.get_next_display_order(db_session, test_event.id)

        # Assert
        assert next_order == 0
