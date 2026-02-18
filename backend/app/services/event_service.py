"""Event Service - Business logic for event management."""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

import pytz
from fastapi import HTTPException, status
from slugify import slugify
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.metrics import EVENTS_CLOSED_TOTAL, EVENTS_CREATED_TOTAL, EVENTS_PUBLISHED_TOTAL
from app.models.auction_item import AuctionItem
from app.models.event import Event, EventLink, EventMedia, EventStatus, FoodOption
from app.models.event_registration import EventRegistration
from app.models.npo import NPO, NPOStatus
from app.models.registration_guest import RegistrationGuest
from app.models.sponsor import Sponsor
from app.models.user import User
from app.schemas.event import EventCreateRequest, EventUpdateRequest

logger = logging.getLogger(__name__)


class EventService:
    """Service for event management operations."""

    @staticmethod
    async def create_event(
        db: AsyncSession,
        event_data: EventCreateRequest,
        current_user: User,
    ) -> Event:
        """
        Create a new event in DRAFT status.

        Args:
            db: Database session
            event_data: Event creation data
            current_user: User creating the event

        Returns:
            Created Event object

        Raises:
            HTTPException: If NPO not found/approved or validation fails
        """
        # Verify NPO exists and is approved
        npo_result = await db.execute(select(NPO).where(NPO.id == event_data.npo_id))
        npo = npo_result.scalar_one_or_none()

        if not npo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NPO with ID {event_data.npo_id} not found",
            )

        if npo.status != NPOStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Events can only be created for approved NPOs",
            )

        # Validate timezone
        EventService._validate_timezone(event_data.timezone)

        # Validate event datetime is in future
        if event_data.event_datetime <= datetime.now(pytz.UTC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event date must be in the future",
            )

        # Generate unique slug
        slug = await EventService._generate_unique_slug(db, event_data.name, event_data.custom_slug)

        # Create event
        event = Event(
            **event_data.model_dump(exclude={"custom_slug"}),
            slug=slug,
            status=EventStatus.DRAFT,
            version=1,
            created_by=current_user.id,
            updated_by=current_user.id,
        )

        db.add(event)
        await db.commit()
        await db.refresh(event, ["media", "links", "food_options"])

        # Increment metrics
        EVENTS_CREATED_TOTAL.labels(npo_id=str(event.npo_id)).inc()

        logger.info(f"Event created: {event.name} (ID: {event.id}) by user {current_user.id}")
        return event

    @staticmethod
    async def update_event(
        db: AsyncSession,
        event_id: uuid.UUID,
        event_data: EventUpdateRequest,
        current_user: User,
    ) -> Event:
        """
        Update event details with optimistic locking.

        Args:
            db: Database session
            event_id: Event UUID
            event_data: Update data
            current_user: User making the update

        Returns:
            Updated Event object

        Raises:
            HTTPException: If event not found or version conflict
        """
        event = await EventService.get_event_by_id(db, event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found",
            )

        # Optimistic locking check
        if event_data.version is not None and event.version != event_data.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "Conflict: event was modified by another user",
                    "current_version": event.version,
                    "your_version": event_data.version,
                },
            )

        # Validate timezone if being updated
        if event_data.timezone:
            EventService._validate_timezone(event_data.timezone)

        # Update fields
        update_dict = event_data.model_dump(exclude_unset=True, exclude={"version"})
        for key, value in update_dict.items():
            setattr(event, key, value)

        event.updated_by = current_user.id
        event.version += 1

        await db.commit()

        # Re-query to get fresh data with all relationships loaded
        result = await db.execute(
            select(Event)
            .where(Event.id == event_id)
            .options(
                selectinload(Event.media),
                selectinload(Event.links),
                selectinload(Event.food_options),
            )
        )
        event = result.scalar_one()

        logger.info(f"Event updated: {event.name} (ID: {event.id}) by user {current_user.id}")
        return event

    @staticmethod
    async def publish_event(
        db: AsyncSession,
        event_id: uuid.UUID,
        current_user: User,
    ) -> Event:
        """Change event status from draft to active."""
        event = await EventService.get_event_by_id(db, event_id)
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        if event.status != EventStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Event is already {event.status.value}",
            )

        event.status = EventStatus.ACTIVE
        event.updated_by = current_user.id

        await db.commit()

        # Re-query to get fresh data with all relationships loaded
        result = await db.execute(
            select(Event)
            .where(Event.id == event_id)
            .options(
                selectinload(Event.media),
                selectinload(Event.links),
                selectinload(Event.food_options),
            )
        )
        event = result.scalar_one()

        # Increment metrics
        EVENTS_PUBLISHED_TOTAL.inc()

        logger.info(f"Event published: {event.name} (ID: {event.id})")
        return event

    @staticmethod
    async def close_event(
        db: AsyncSession,
        event_id: uuid.UUID,
        current_user: User,
    ) -> Event:
        """Manually close an active event."""
        event = await EventService.get_event_by_id(db, event_id)
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        if event.status != EventStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only active events can be closed",
            )

        event.status = EventStatus.CLOSED
        event.updated_by = current_user.id

        await db.commit()

        # Re-query to get fresh data with all relationships loaded
        result = await db.execute(
            select(Event)
            .where(Event.id == event_id)
            .options(
                selectinload(Event.media),
                selectinload(Event.links),
                selectinload(Event.food_options),
            )
        )
        event = result.scalar_one()

        # Increment metrics
        EVENTS_CLOSED_TOTAL.labels(closure_type="manual").inc()

        logger.info(f"Event manually closed: {event.name} (ID: {event.id})")
        return event

    @staticmethod
    async def delete_event(
        db: AsyncSession,
        event_id: uuid.UUID,
        current_user: User,
    ) -> None:
        """
        Delete an event.

        Business Rules:
        - Cannot delete published/active events (must close first)
        - Authorization checked at endpoint level with @require_role
        """
        # Get event
        result = await db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found",
            )

        # Cannot delete active events
        if event.status == EventStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete an active event. Please close it first.",
            )

        # Delete event (hard delete - cascades to related entities)
        await db.delete(event)
        await db.commit()

        logger.info(f"Event deleted: {event.name} (ID: {event.id}) by user {current_user.id}")

    @staticmethod
    async def get_event_by_id(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> Event | None:
        """Get event by ID with all relationships."""
        query = (
            select(Event)
            .where(Event.id == event_id)
            .options(
                selectinload(Event.npo),
                selectinload(Event.media),
                selectinload(Event.links),
                selectinload(Event.food_options),
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_event_by_slug(
        db: AsyncSession,
        slug: str,
    ) -> Event | None:
        """Get active event by slug for public pages."""
        query = (
            select(Event)
            .where(and_(Event.slug == slug, Event.status == EventStatus.ACTIVE))
            .options(
                selectinload(Event.media),
                selectinload(Event.links),
                selectinload(Event.food_options),
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_events(
        db: AsyncSession,
        npo_id: uuid.UUID | None = None,
        status_filter: EventStatus | None = None,
        page: int = 1,
        per_page: int = 20,
        search_query: str | None = None,
    ) -> tuple[list[Event], int]:
        """List events with filtering, pagination, and optional search."""
        from sqlalchemy.orm import selectinload

        query = select(Event).options(selectinload(Event.npo))

        if npo_id:
            query = query.where(Event.npo_id == npo_id)
        if status_filter:
            query = query.where(Event.status == status_filter)
        if search_query:
            trimmed = search_query.strip()
            if trimmed:
                like_pattern = f"%{trimmed}%"
                query = query.where(
                    or_(
                        Event.name.ilike(like_pattern),
                        Event.slug.ilike(like_pattern),
                    )
                )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate
        query = query.order_by(Event.event_datetime.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await db.execute(query)
        events = list(result.scalars().all())

        return events, total

    @staticmethod
    async def get_event_stats(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> dict[str, Any] | None:
        """Aggregate badge counts for an event."""

        media_count = (
            select(func.count(EventMedia.id))
            .where(EventMedia.event_id == Event.id)
            .correlate(Event)
            .scalar_subquery()
        )
        link_count = (
            select(func.count(EventLink.id))
            .where(EventLink.event_id == Event.id)
            .correlate(Event)
            .scalar_subquery()
        )
        food_option_count = (
            select(func.count(FoodOption.id))
            .where(FoodOption.event_id == Event.id)
            .correlate(Event)
            .scalar_subquery()
        )
        sponsor_count = (
            select(func.count(Sponsor.id))
            .where(Sponsor.event_id == Event.id)
            .correlate(Event)
            .scalar_subquery()
        )
        auction_item_count = (
            select(func.count(AuctionItem.id))
            .where(AuctionItem.event_id == Event.id)
            .correlate(Event)
            .scalar_subquery()
        )
        registration_count = (
            select(func.count(RegistrationGuest.id))
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == Event.id,
                RegistrationGuest.is_primary.is_(True),
            )
            .correlate(Event)
            .scalar_subquery()
        )
        active_registration_count = (
            select(func.count(RegistrationGuest.id))
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == Event.id,
                RegistrationGuest.is_primary.is_(True),
                RegistrationGuest.status != "cancelled",
            )
            .correlate(Event)
            .scalar_subquery()
        )
        guest_count = (
            select(func.count(RegistrationGuest.id))
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == Event.id,
                RegistrationGuest.is_primary.is_(False),
            )
            .correlate(Event)
            .scalar_subquery()
        )
        active_guest_count = (
            select(func.count(RegistrationGuest.id))
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == Event.id,
                RegistrationGuest.is_primary.is_(False),
                RegistrationGuest.status != "cancelled",
            )
            .correlate(Event)
            .scalar_subquery()
        )

        query = (
            select(
                Event.id,
                Event.npo_id,
                media_count.label("media_count"),
                link_count.label("links_count"),
                food_option_count.label("food_options_count"),
                sponsor_count.label("sponsors_count"),
                auction_item_count.label("auction_items_count"),
                registration_count.label("registrations_count"),
                active_registration_count.label("active_registrations_count"),
                guest_count.label("guest_count"),
                active_guest_count.label("active_guest_count"),
            )
            .where(Event.id == event_id)
            .limit(1)
        )

        result = await db.execute(query)
        row = result.first()
        if not row:
            return None

        mapping = row._mapping
        return {
            "event_id": mapping["id"],
            "npo_id": mapping["npo_id"],
            "media_count": mapping["media_count"],
            "links_count": mapping["links_count"],
            "food_options_count": mapping["food_options_count"],
            "sponsors_count": mapping["sponsors_count"],
            "auction_items_count": mapping["auction_items_count"],
            "registrations_count": mapping["registrations_count"],
            "active_registrations_count": mapping["active_registrations_count"],
            "guest_count": mapping["guest_count"],
            "active_guest_count": mapping["active_guest_count"],
        }

    @staticmethod
    async def _generate_unique_slug(
        db: AsyncSession,
        event_name: str,
        custom_slug: str | None = None,
    ) -> str:
        """Generate a unique URL slug for the event."""
        base_slug = custom_slug if custom_slug else slugify(event_name)

        # Check if slug is unique
        slug = base_slug
        counter = 1

        while counter <= 3:  # Max 3 attempts
            existing = await db.execute(select(Event).where(Event.slug == slug))
            if not existing.scalar_one_or_none():
                return slug

            # Try with counter suffix
            counter += 1
            slug = f"{base_slug}-{counter}"

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to generate unique slug after 3 attempts",
        )

    @staticmethod
    def _validate_timezone(timezone: str) -> None:
        """Validate IANA timezone name."""
        try:
            pytz.timezone(timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid timezone: {timezone}",
            )


async def close_expired_events(db: AsyncSession) -> int:
    """
    Celery task: Close events 24 hours after event_datetime.

    Returns:
        Number of events closed
    """
    cutoff_time = datetime.now(pytz.UTC) - timedelta(hours=24)

    query = select(Event).where(
        and_(Event.status == EventStatus.ACTIVE, Event.event_datetime < cutoff_time)
    )

    result = await db.execute(query)
    events_to_close = list(result.scalars().all())

    for event in events_to_close:
        event.status = EventStatus.CLOSED
        event.version += 1

    if events_to_close:
        await db.commit()
        # Increment metrics for automatic closure
        EVENTS_CLOSED_TOTAL.labels(closure_type="automatic").inc(len(events_to_close))
        logger.info(f"Auto-closed {len(events_to_close)} expired events")

    return len(events_to_close)
