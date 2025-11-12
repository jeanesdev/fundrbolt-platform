"""Sponsor Service - Business logic for event sponsor management."""

import logging
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sponsor import Sponsor
from app.models.user import User
from app.schemas.sponsor import SponsorCreate, SponsorUpdate

logger = logging.getLogger(__name__)


class SponsorService:
    """Service for managing event sponsors."""

    @staticmethod
    async def get_sponsors_for_event(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> list[Sponsor]:
        """
        Get all sponsors for an event, ordered by display_order and logo_size.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            List of sponsors ordered by display_order ASC, logo_size DESC
        """
        query = (
            select(Sponsor)
            .where(Sponsor.event_id == event_id)
            .order_by(Sponsor.display_order.asc(), Sponsor.logo_size.desc())
        )

        result = await db.execute(query)
        sponsors = result.scalars().all()

        logger.info(f"Retrieved {len(sponsors)} sponsors for event {event_id}")
        return list(sponsors)

    @staticmethod
    async def get_sponsor_by_id(
        db: AsyncSession,
        sponsor_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> Sponsor | None:
        """
        Get a sponsor by ID, ensuring it belongs to the specified event.

        Args:
            db: Database session
            sponsor_id: Sponsor UUID
            event_id: Event UUID

        Returns:
            Sponsor if found and belongs to event, None otherwise
        """
        query = select(Sponsor).where(
            Sponsor.id == sponsor_id,
            Sponsor.event_id == event_id,
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def check_duplicate_name(
        db: AsyncSession,
        event_id: uuid.UUID,
        name: str,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        """
        Check if a sponsor name already exists for an event.

        Args:
            db: Database session
            event_id: Event UUID
            name: Sponsor name to check
            exclude_id: Optional sponsor ID to exclude (for updates)

        Returns:
            True if duplicate exists, False otherwise
        """
        query = select(func.count(Sponsor.id)).where(
            Sponsor.event_id == event_id,
            Sponsor.name == name,
        )

        if exclude_id:
            query = query.where(Sponsor.id != exclude_id)

        result = await db.execute(query)
        count = result.scalar_one()

        return count > 0

    @staticmethod
    async def get_next_display_order(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> int:
        """
        Get the next display_order value for a new sponsor.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            Next display_order value (max + 1, or 0 if no sponsors exist)
        """
        query = select(func.max(Sponsor.display_order)).where(Sponsor.event_id == event_id)

        result = await db.execute(query)
        max_order = result.scalar_one_or_none()

        return (max_order + 1) if max_order is not None else 0

    @staticmethod
    async def create_sponsor(
        db: AsyncSession,
        event_id: uuid.UUID,
        data: SponsorCreate,
        current_user: User,
    ) -> Sponsor:
        """
        Create a new sponsor for an event.

        This creates the sponsor record with placeholder logo URLs.
        The actual logo upload happens in a two-step process:
        1. Create sponsor (this method)
        2. Upload logo to Azure Blob Storage using SAS URL
        3. Confirm upload (updates logo_url and thumbnail_url)

        Args:
            db: Database session
            event_id: Event UUID
            data: Sponsor creation data
            current_user: Current authenticated user

        Returns:
            Created sponsor instance

        Raises:
            HTTPException: If sponsor name already exists for event
        """
        # Check for duplicate name
        if await SponsorService.check_duplicate_name(db, event_id, data.name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sponsor name '{data.name}' already exists for this event",
            )

        # Get next display order
        display_order = await SponsorService.get_next_display_order(db, event_id)

        # Create sponsor with placeholder logo URLs (will be updated after upload)
        sponsor_id = uuid.uuid4()
        sponsor = Sponsor(
            id=sponsor_id,
            event_id=event_id,
            name=data.name,
            logo_url="",  # Will be set after upload confirmation
            logo_blob_name="",  # Will be set after upload confirmation
            thumbnail_url="",  # Will be set after upload confirmation
            thumbnail_blob_name="",  # Will be set after upload confirmation
            website_url=str(data.website_url) if data.website_url else None,
            logo_size=data.logo_size,
            sponsor_level=data.sponsor_level,
            contact_name=data.contact_name,
            contact_email=data.contact_email,
            contact_phone=data.contact_phone,
            address_line1=data.address_line1,
            address_line2=data.address_line2,
            city=data.city,
            state=data.state,
            postal_code=data.postal_code,
            country=data.country,
            donation_amount=data.donation_amount,
            notes=data.notes,
            display_order=display_order,
            created_by=current_user.id,
        )

        db.add(sponsor)
        await db.commit()
        await db.refresh(sponsor)

        logger.info(f"Created sponsor {sponsor.id} for event {event_id} by user {current_user.id}")

        return sponsor

    @staticmethod
    async def update_sponsor(
        db: AsyncSession,
        sponsor_id: uuid.UUID,
        event_id: uuid.UUID,
        data: SponsorUpdate,
    ) -> Sponsor:
        """
        Update a sponsor's information.

        Args:
            db: Database session
            sponsor_id: Sponsor UUID
            event_id: Event UUID
            data: Updated sponsor data

        Returns:
            Updated sponsor instance

        Raises:
            HTTPException: If sponsor not found or name already exists
        """
        sponsor = await SponsorService.get_sponsor_by_id(db, sponsor_id, event_id)
        if not sponsor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sponsor not found",
            )

        # Check for duplicate name if name is being changed
        if data.name and data.name != sponsor.name:
            if await SponsorService.check_duplicate_name(
                db, event_id, data.name, exclude_id=sponsor_id
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sponsor name '{data.name}' already exists for this event",
                )

        # Update fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            # Handle empty strings as None for optional fields
            if isinstance(value, str) and value == "":
                value = None
            # Convert HttpUrl to string
            if field == "website_url" and value:
                value = str(value)
            setattr(sponsor, field, value)

        sponsor.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(sponsor)

        logger.info(f"Updated sponsor {sponsor_id} for event {event_id}")

        return sponsor

    @staticmethod
    async def delete_sponsor(
        db: AsyncSession,
        sponsor_id: uuid.UUID,
        event_id: uuid.UUID,
    ) -> None:
        """
        Delete a sponsor.

        Note: Logo blob cleanup happens in the API layer via SponsorLogoService.

        Args:
            db: Database session
            sponsor_id: Sponsor UUID
            event_id: Event UUID

        Raises:
            HTTPException: If sponsor not found
        """
        sponsor = await SponsorService.get_sponsor_by_id(db, sponsor_id, event_id)
        if not sponsor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sponsor not found",
            )

        await db.delete(sponsor)
        await db.commit()

        logger.info(f"Deleted sponsor {sponsor_id} from event {event_id}")

    @staticmethod
    async def reorder_sponsors(
        db: AsyncSession,
        event_id: uuid.UUID,
        sponsor_ids_ordered: list[uuid.UUID],
    ) -> list[Sponsor]:
        """
        Reorder sponsors based on provided order.

        Args:
            db: Database session
            event_id: Event UUID
            sponsor_ids_ordered: List of sponsor UUIDs in desired order

        Returns:
            List of reordered sponsors

        Raises:
            HTTPException: If any sponsor ID is invalid or doesn't belong to event
        """
        # Fetch all sponsors for validation
        all_sponsors = await SponsorService.get_sponsors_for_event(db, event_id)
        all_sponsor_ids = {sponsor.id for sponsor in all_sponsors}

        # Validate that all provided IDs belong to this event
        provided_ids = set(sponsor_ids_ordered)
        if not provided_ids.issubset(all_sponsor_ids):
            invalid_ids = provided_ids - all_sponsor_ids
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sponsor IDs: {invalid_ids}",
            )

        # Update display_order for each sponsor
        for index, sponsor_id in enumerate(sponsor_ids_ordered):
            query = select(Sponsor).where(Sponsor.id == sponsor_id, Sponsor.event_id == event_id)
            result = await db.execute(query)
            sponsor = result.scalar_one()
            sponsor.display_order = index
            sponsor.updated_at = datetime.utcnow()

        await db.commit()

        logger.info(f"Reordered {len(sponsor_ids_ordered)} sponsors for event {event_id}")

        # Return sponsors in new order
        return await SponsorService.get_sponsors_for_event(db, event_id)
