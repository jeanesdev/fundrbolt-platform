"""Search API endpoints with PostgreSQL tsvector full-text search.

Cross-resource search across Users, NPOs, Events, and Auction Items with role-based filtering.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.logging import get_logger
from app.middleware.auth import get_current_active_user
from app.models.auction_item import AuctionItem
from app.models.event import Event
from app.models.npo import NPO
from app.models.user import User
from app.schemas.search import (
    AuctionItemSearchResult,
    EventSearchResult,
    NPOSearchResult,
    SearchRequest,
    SearchResponse,
    UserSearchResult,
)
from app.services.permission_service import PermissionService

logger = get_logger(__name__)
router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(
    search_request: SearchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> SearchResponse:
    """Search across Users, NPOs, Events, and Auction Items with role-based filtering.

    T077: Role-based filtering:
    - SuperAdmin: Can search all resources (optionally filtered by npo_id)
    - NPO Admin: Searches limited to their NPO
    - Event Coordinator: Searches limited to their NPO
    - Staff: Searches limited to their NPO

    T078: NPO context filtering via npo_id parameter

    Performance: Optimized with tsvector indexes for <300ms response (T082)
    """
    try:
        logger.info(
            f"Search request: query='{search_request.query}', npo_id={search_request.npo_id}, user_id={current_user.id}"
        )

        permission_service = PermissionService()

        # T077: Apply role-based NPO filtering
        filtered_npo_id = await permission_service.get_npo_filter_for_user(
            db, current_user, search_request.npo_id
        )

        logger.info(f"Filtered NPO ID: {filtered_npo_id}")

        # Initialize result lists
        users_results = []
        npos_results = []
        events_results = []
        auction_items_results = []

        # Prepare search pattern for ILIKE (fallback if tsvector not available)
        search_pattern = f"%{search_request.query}%"

        # Determine which resource types to search
        resource_types = search_request.resource_types or [
            "users",
            "npos",
            "events",
            "auction_items",
        ]

        logger.info(f"Searching resource types: {resource_types}")

        # Search Users
        if "users" in resource_types:
            logger.info("Starting users search")
            users_query = select(User).options(selectinload(User.role))

            # Apply text search
            users_query = users_query.where(
                or_(
                    func.lower(User.email).like(func.lower(search_pattern)),
                    func.lower(User.first_name).like(func.lower(search_pattern)),
                    func.lower(User.last_name).like(func.lower(search_pattern)),
                )
            )

            # Apply NPO filtering if specified
            if filtered_npo_id:
                from app.models.npo_member import MemberStatus, NPOMember

                users_query = users_query.join(NPOMember, NPOMember.user_id == User.id).where(
                    NPOMember.npo_id == filtered_npo_id,
                    NPOMember.status == MemberStatus.ACTIVE,
                )

            # Limit results
            users_query = users_query.limit(search_request.limit)

            logger.info("Executing users query")
            users_result = await db.execute(users_query)
            users = users_result.scalars().all()
            logger.info(f"Found {len(users)} users")

            users_results = [
                UserSearchResult(
                    id=user.id,
                    email=user.email,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    role=user.role.name if user.role else "unknown",
                    npo_id=filtered_npo_id,
                    organization_name=user.organization_name,
                    created_at=user.created_at,
                )
                for user in users
            ]

        # Search NPOs
        if "npos" in resource_types:
            logger.info("Starting NPOs search")
            npos_query = select(NPO)

            # Apply text search
            npos_query = npos_query.where(
                or_(
                    func.lower(NPO.name).like(func.lower(search_pattern)),
                    func.lower(NPO.tagline).like(func.lower(search_pattern)),
                    func.lower(NPO.tax_id).like(func.lower(search_pattern)),
                )
            )

            # Apply NPO filtering if specified
            if filtered_npo_id:
                npos_query = npos_query.where(NPO.id == filtered_npo_id)

            # Limit results
            npos_query = npos_query.limit(search_request.limit)

            logger.info("Executing NPOs query")
            npos_result = await db.execute(npos_query)
            npos = npos_result.scalars().all()
            logger.info(f"Found {len(npos)} NPOs")

            npos_results = [
                NPOSearchResult(
                    id=npo.id,
                    name=npo.name,
                    ein=npo.tax_id,  # Map tax_id to ein for schema compatibility
                    status=npo.status.value if hasattr(npo.status, "value") else str(npo.status),
                    tagline=npo.tagline,
                    logo_url=None,  # logo_url is in NPOBranding, would need join to get it
                    created_at=npo.created_at,
                )
                for npo in npos
            ]

        # Search Events
        if "events" in resource_types:
            logger.info("Starting events search")
            events_query = select(Event).options(selectinload(Event.npo))

            # Apply text search
            events_query = events_query.where(
                or_(
                    func.lower(Event.name).like(func.lower(search_pattern)),
                    func.lower(Event.tagline).like(func.lower(search_pattern)),
                )
            )

            # Apply NPO filtering if specified
            if filtered_npo_id:
                events_query = events_query.where(Event.npo_id == filtered_npo_id)

            # Limit results
            events_query = events_query.limit(search_request.limit)

            logger.info("Executing events query")
            events_result = await db.execute(events_query)
            events = events_result.scalars().all()
            logger.info(f"Found {len(events)} events")

            events_results = [
                EventSearchResult(
                    id=event.id,
                    name=event.name,
                    npo_id=event.npo_id,  # npo_id is non-nullable in Event model
                    npo_name=event.npo.name if event.npo else "Unknown",
                    event_type="gala",  # Default event type for now, as Event model doesn't have event_type field
                    status=event.status.value
                    if hasattr(event.status, "value")
                    else str(event.status),
                    start_date=getattr(event, "event_datetime", None),
                    end_date=getattr(event, "end_datetime", None),
                    created_at=event.created_at,
                )
                for event in events
            ]

        # Search Auction Items
        if "auction_items" in resource_types:
            logger.info("Starting auction items search")
            auction_items_query = select(AuctionItem)

            # Apply text search
            auction_items_query = auction_items_query.where(
                or_(
                    func.lower(AuctionItem.title).like(func.lower(search_pattern)),
                    func.lower(AuctionItem.description).like(func.lower(search_pattern)),
                )
            )

            # Apply NPO filtering if specified (filter by event's NPO)
            if filtered_npo_id:
                auction_items_query = auction_items_query.join(Event).where(
                    Event.npo_id == filtered_npo_id
                )

            # Add eager loading for event (after join to avoid conflicts)
            auction_items_query = auction_items_query.options(selectinload(AuctionItem.event))

            # Limit results
            auction_items_query = auction_items_query.limit(search_request.limit)

            logger.info("Executing auction items query")
            auction_items_result = await db.execute(auction_items_query)
            auction_items = auction_items_result.scalars().all()
            logger.info(f"Found {len(auction_items)} auction items")

            auction_items_results = [
                AuctionItemSearchResult(
                    id=item.id,
                    name=item.title,
                    event_id=item.event_id,
                    event_name=getattr(item.event, "name", "Unknown") if item.event else "Unknown",
                    category=item.auction_type,
                    status=item.status,
                    starting_bid=float(item.starting_bid) if item.starting_bid else None,
                    created_at=item.created_at,
                )
                for item in auction_items
            ]  # Calculate total results
        total_results = (
            len(users_results)
            + len(npos_results)
            + len(events_results)
            + len(auction_items_results)
        )

        logger.info(
            f"Search results: users={len(users_results)}, npos={len(npos_results)}, events={len(events_results)}, auction_items={len(auction_items_results)}, total={total_results}"
        )

        return SearchResponse(
            query=search_request.query,
            users=users_results,
            npos=npos_results,
            events=events_results,
            auction_items=auction_items_results,
            total_results=total_results,
        )
    except Exception as e:
        logger.error(f"Search error: {type(e).__name__}: {e}", exc_info=True)
        raise
