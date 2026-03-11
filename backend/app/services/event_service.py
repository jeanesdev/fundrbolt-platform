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
from app.models.auction_bid import AuctionBid
from app.models.auction_item import AuctionItem
from app.models.audit_log import AuditLog
from app.models.donation_label import DonationLabel
from app.models.event import Event, EventLink, EventMedia, EventStatus, FoodOption
from app.models.event_registration import EventRegistration
from app.models.event_table import EventTable
from app.models.npo import NPO, NPOStatus
from app.models.registration_guest import RegistrationGuest
from app.models.sponsor import Sponsor
from app.models.ticket_management import CustomTicketOption, TicketPackage
from app.models.user import User
from app.schemas.event import DuplicateEventRequest, EventCreateRequest, EventUpdateRequest

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
        event.checkout_open = True  # auto-open checkout when event closes
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
    async def duplicate_event(
        db: AsyncSession,
        event_id: uuid.UUID,
        current_user: User,
        options: DuplicateEventRequest | None = None,
    ) -> Event:
        """
        Duplicate an existing event into a new DRAFT event.

        Clones event details, food options, ticket packages (with custom
        options), table configuration, and sponsors. Optionally includes
        media files (deep-copied), event links, and donation labels based
        on ``options``.

        Args:
            db: Database session
            event_id: UUID of the source event to duplicate
            current_user: User performing the duplication
            options: Optional inclusion toggles (media, links, labels)

        Returns:
            The newly created Event (with relationships loaded)

        Raises:
            HTTPException 404: Source event not found
        """
        if options is None:
            options = DuplicateEventRequest()

        # Load source event with all relationships we need to clone
        source = await db.execute(
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
        source_event = source.scalar_one_or_none()
        if not source_event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )

        # Build the cloned name (truncated to 255 chars)
        clone_name = f"{source_event.name} (Copy)"[:255]

        # Generate a unique slug for the clone
        new_slug = await EventService._generate_unique_slug(db, clone_name)

        # ---- Create the new Event ----
        new_event = Event(
            npo_id=source_event.npo_id,
            name=clone_name,
            slug=new_slug,
            custom_slug=None,
            tagline=source_event.tagline,
            status=EventStatus.DRAFT,
            event_datetime=source_event.event_datetime,
            timezone=source_event.timezone,
            venue_name=source_event.venue_name,
            venue_address=source_event.venue_address,
            venue_city=source_event.venue_city,
            venue_state=source_event.venue_state,
            venue_zip=source_event.venue_zip,
            attire=source_event.attire,
            fundraising_goal=source_event.fundraising_goal,
            primary_contact_name=source_event.primary_contact_name,
            primary_contact_email=source_event.primary_contact_email,
            primary_contact_phone=source_event.primary_contact_phone,
            description=source_event.description,
            logo_url=source_event.logo_url,
            primary_color=source_event.primary_color,
            secondary_color=source_event.secondary_color,
            background_color=source_event.background_color,
            accent_color=source_event.accent_color,
            hero_transition_style=source_event.hero_transition_style,
            table_count=source_event.table_count,
            max_guests_per_table=source_event.max_guests_per_table,
            seating_layout_image_url=None,
            version=1,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(new_event)
        # Flush to obtain the new event's ID for child records
        await db.flush()

        # ---- Always-cloned children ----

        # FoodOption
        for fo in source_event.food_options:
            db.add(
                FoodOption(
                    event_id=new_event.id,
                    name=fo.name,
                    description=fo.description,
                    display_order=fo.display_order,
                )
            )

        # TicketPackage + CustomTicketOption
        for tp in source_event.ticket_packages:
            new_tp = TicketPackage(
                event_id=new_event.id,
                created_by=current_user.id,
                name=tp.name,
                description=tp.description,
                price=tp.price,
                seats_per_package=tp.seats_per_package,
                quantity_limit=tp.quantity_limit,
                sold_count=0,
                display_order=tp.display_order,
                image_url=tp.image_url,
                is_enabled=tp.is_enabled,
                is_sponsorship=tp.is_sponsorship,
                version=1,
            )
            db.add(new_tp)
            await db.flush()  # need new_tp.id for children

            for cto in tp.custom_options:
                db.add(
                    CustomTicketOption(
                        ticket_package_id=new_tp.id,
                        option_label=cto.option_label,
                        option_type=cto.option_type,
                        choices=cto.choices,
                        is_required=cto.is_required,
                        display_order=cto.display_order,
                    )
                )

        # EventTable (captain cleared)
        for et in source_event.tables:
            db.add(
                EventTable(
                    event_id=new_event.id,
                    table_number=et.table_number,
                    custom_capacity=et.custom_capacity,
                    table_name=et.table_name,
                    table_captain_id=None,
                )
            )

        # Sponsor (logo refs shared)
        for sp in source_event.sponsors:
            db.add(
                Sponsor(
                    event_id=new_event.id,
                    created_by=current_user.id,
                    name=sp.name,
                    logo_url=sp.logo_url,
                    logo_blob_name=sp.logo_blob_name,
                    thumbnail_url=sp.thumbnail_url,
                    thumbnail_blob_name=sp.thumbnail_blob_name,
                    logo_size=sp.logo_size,
                    display_order=sp.display_order,
                    website_url=sp.website_url,
                    sponsor_level=sp.sponsor_level,
                    contact_name=sp.contact_name,
                    contact_email=sp.contact_email,
                    contact_phone=sp.contact_phone,
                    address_line1=sp.address_line1,
                    address_line2=sp.address_line2,
                    city=sp.city,
                    state=sp.state,
                    postal_code=sp.postal_code,
                    country=sp.country,
                    donation_amount=sp.donation_amount,
                    notes=sp.notes,
                )
            )

        # ---- Conditionally-cloned children ----

        # EventMedia (deep-copy blobs)
        if options.include_media:
            from app.services.media_service import MediaService

            for em in source_event.media:
                new_media_id = uuid.uuid4()
                target_blob = f"events/{new_event.id}/{new_media_id}/{em.file_name}"
                try:
                    new_url = await MediaService.copy_blob(em.blob_name, target_blob)
                except Exception:
                    logger.warning(
                        "Failed to copy blob %s -> %s for event duplication; skipping",
                        em.blob_name,
                        target_blob,
                        exc_info=True,
                    )
                    continue

                db.add(
                    EventMedia(
                        event_id=new_event.id,
                        media_type=em.media_type,
                        usage_tag=em.usage_tag,
                        file_url=new_url,
                        file_name=em.file_name,
                        file_type=em.file_type,
                        mime_type=em.mime_type,
                        blob_name=target_blob,
                        file_size=em.file_size,
                        display_order=em.display_order,
                        status=em.status,
                        uploaded_by=current_user.id,
                    )
                )

            # Also deep-copy seating layout image if present
            if source_event.seating_layout_image_url:
                # Parse the blob name from the stored URL rather than hard-coding
                # a path. The URL format is:
                # https://<account>.blob.core.windows.net/<container>/<blob_path>
                from urllib.parse import urlparse

                parsed = urlparse(source_event.seating_layout_image_url)
                # path is "/<container>/<blob_path>" – strip container prefix
                path_parts = parsed.path.lstrip("/").split("/", 1)
                if len(path_parts) == 2:
                    layout_blob = path_parts[1]
                else:
                    # Fallback: use the full path minus leading slash
                    layout_blob = parsed.path.lstrip("/")

                target_layout_blob = f"events/{new_event.id}/seating-layout/{uuid.uuid4()}"
                try:
                    layout_url = await MediaService.copy_blob(layout_blob, target_layout_blob)
                    new_event.seating_layout_image_url = layout_url
                except Exception:
                    logger.warning(
                        "Failed to copy seating layout image %s -> %s for event duplication",
                        layout_blob,
                        target_layout_blob,
                        exc_info=True,
                    )

        # EventLink
        if options.include_links:
            for el in source_event.links:
                db.add(
                    EventLink(
                        event_id=new_event.id,
                        link_type=el.link_type,
                        url=el.url,
                        label=el.label,
                        platform=el.platform,
                        display_order=el.display_order,
                        created_by=current_user.id,
                    )
                )

        # DonationLabel
        if options.include_donation_labels:
            for dl in source_event.donation_labels:
                db.add(
                    DonationLabel(
                        event_id=new_event.id,
                        name=dl.name,
                        is_active=dl.is_active,
                        retired_at=None,
                    )
                )

        # Write audit log in the same transaction for atomicity
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="event_duplicated",
                resource_type="event",
                resource_id=new_event.id,
                ip_address="unknown",
                user_agent=None,
                event_metadata={
                    "source_event_id": str(event_id),
                    "new_event_id": str(new_event.id),
                    "include_media": options.include_media,
                    "include_links": options.include_links,
                    "include_donation_labels": options.include_donation_labels,
                },
            )
        )

        await db.commit()

        # Reload the new event with relationships for the response
        result = await db.execute(
            select(Event)
            .where(Event.id == new_event.id)
            .options(
                selectinload(Event.npo),
                selectinload(Event.media),
                selectinload(Event.links),
                selectinload(Event.food_options),
            )
        )
        new_event = result.scalar_one()

        logger.info(
            "Event duplicated: '%s' (ID: %s) -> '%s' (ID: %s) by user %s",
            source_event.name,
            source_event.id,
            new_event.name,
            new_event.id,
            current_user.id,
        )
        return new_event

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
        auction_bid_count = (
            select(func.count(AuctionBid.id))
            .where(AuctionBid.event_id == Event.id)
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
                auction_bid_count.label("auction_bids_count"),
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
            "auction_bids_count": mapping["auction_bids_count"],
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
        event.checkout_open = True  # auto-open checkout when event closes
        event.version += 1

    if events_to_close:
        await db.commit()
        # Increment metrics for automatic closure
        EVENTS_CLOSED_TOTAL.labels(closure_type="automatic").inc(len(events_to_close))
        logger.info(f"Auto-closed {len(events_to_close)} expired events")

    return len(events_to_close)
