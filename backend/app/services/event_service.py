"""Event Service - Business logic for event management."""

import logging
import uuid
from datetime import datetime, timedelta

import pytz
from fastapi import HTTPException, status
from slugify import slugify
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.metrics import EVENTS_CLOSED_TOTAL, EVENTS_CREATED_TOTAL, EVENTS_PUBLISHED_TOTAL
from app.models.event import Event, EventStatus
from app.models.npo import NPO, NPOStatus
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

        # Increment metrics
        EVENTS_CLOSED_TOTAL.labels(closure_type="manual").inc()

        logger.info(f"Event manually closed: {event.name} (ID: {event.id})")
        return event

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
    ) -> tuple[list[Event], int]:
        """List events with filtering and pagination."""
        query = select(Event)

        if npo_id:
            query = query.where(Event.npo_id == npo_id)
        if status_filter:
            query = query.where(Event.status == status_filter)

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
