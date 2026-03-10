"""Event Preview API endpoints.

Provides endpoints for:
- Generating short-lived preview tokens (admin-only)
- Fetching bundled event data for donor preview (token-authenticated)
"""

import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from urllib.parse import unquote, urlparse

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_preview_token, decode_token
from app.middleware.auth import get_current_active_user
from app.models.auction_bid import AuctionBid, BidStatus
from app.models.auction_item import AuctionItemMedia
from app.models.user import User
from app.schemas.auction_item import AuctionItemDetail, AuctionItemResponse
from app.schemas.auction_item_media import MediaResponse
from app.schemas.event import EventDetailResponse
from app.schemas.preview import PreviewEventResponse, PreviewTokenResponse
from app.schemas.sponsor import SponsorResponse
from app.services.auction_item_media_service import AuctionItemMediaService
from app.services.auction_item_service import AuctionItemService
from app.services.event_service import EventService
from app.services.permission_service import PermissionService
from app.services.sponsor_logo_service import SponsorLogoService
from app.services.sponsor_service import SponsorService

logger = logging.getLogger(__name__)


def _add_sas_urls_to_media(response_dict: dict[str, object]) -> None:
    """Replace event media URLs with short-lived read SAS URLs in-place."""
    from app.services.media_service import MediaService

    media_items = response_dict.get("media")
    if isinstance(media_items, list):
        for media_item in media_items:
            if not isinstance(media_item, dict):
                continue

            file_url = media_item.get("file_url")
            if not isinstance(file_url, str) or not file_url:
                continue

            parsed_url = urlparse(file_url)
            path = parsed_url.path.lstrip("/")
            if not path:
                continue

            path_parts = path.split("/", 1)
            if len(path_parts) < 2:
                continue

            blob_name = unquote(path_parts[1])
            media_item["file_url"] = MediaService.generate_read_sas_url(blob_name)

    layout_url = response_dict.get("seating_layout_image_url")
    if isinstance(layout_url, str) and "blob.core.windows.net" in layout_url:
        parsed_url = urlparse(layout_url)
        path = parsed_url.path.lstrip("/")
        if path:
            path_parts = path.split("/", 1)
            if len(path_parts) >= 2:
                blob_name = unquote(path_parts[1])
                response_dict["seating_layout_image_url"] = MediaService.generate_read_sas_url(
                    blob_name
                )


def _get_sponsor_asset_url(blob_name: str | None, asset_url: str | None) -> str | None:
    """Return a signed sponsor asset URL when a blob name is available."""
    if not blob_name or not asset_url:
        return asset_url

    return SponsorLogoService.generate_blob_sas_url(blob_name, expiry_hours=24)


def _get_signed_auction_asset_url(
    asset_url: str | None,
    media_service: AuctionItemMediaService,
    container_path: str,
) -> str | None:
    """Return a signed auction asset URL when the file is stored in Azure Blob Storage."""
    if not asset_url:
        return asset_url

    if not asset_url.startswith("https://") or container_path not in asset_url:
        return asset_url

    try:
        blob_path = asset_url.split(container_path, 1)[1]
        blob_path = blob_path.split("?", 1)[0]
        return media_service._generate_blob_sas_url(blob_path, expiry_hours=24)
    except (ValueError, IndexError):
        return asset_url


async def _build_preview_auction_items(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> list[AuctionItemDetail]:
    """Build preview auction items with signed primary image and media URLs."""
    auction_service = AuctionItemService(db)
    auction_items_raw, _total = await auction_service.list_auction_items(
        event_id=event_id,
        page=1,
        limit=100,
        include_drafts=True,
    )

    if not auction_items_raw:
        return []

    item_ids = [item.id for item in auction_items_raw]
    bid_aggregates: dict[uuid.UUID, tuple[Decimal | None, int]] = {}
    bid_aggregate_stmt = (
        select(
            AuctionBid.auction_item_id,
            func.max(AuctionBid.bid_amount),
            func.count(AuctionBid.id),
        )
        .where(
            AuctionBid.auction_item_id.in_(item_ids),
            AuctionBid.bid_status.notin_([BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]),
        )
        .group_by(AuctionBid.auction_item_id)
    )
    bid_aggregate_result = await db.execute(bid_aggregate_stmt)
    for auction_item_id, max_bid, bid_count in bid_aggregate_result.all():
        bid_aggregates[auction_item_id] = (max_bid, int(bid_count or 0))

    media_stmt = (
        select(AuctionItemMedia)
        .where(AuctionItemMedia.auction_item_id.in_(item_ids))
        .order_by(AuctionItemMedia.auction_item_id, AuctionItemMedia.display_order)
    )
    media_result = await db.execute(media_stmt)
    media_by_item_id: dict[uuid.UUID, list[AuctionItemMedia]] = defaultdict(list)
    for media_item in media_result.scalars().all():
        media_by_item_id[media_item.auction_item_id].append(media_item)

    settings = get_settings()
    media_service = AuctionItemMediaService(settings, db)
    container_path = f"{settings.azure_storage_container_name}/"

    preview_items: list[AuctionItemDetail] = []
    for item in auction_items_raw:
        item_dict = AuctionItemResponse.model_validate(item, from_attributes=True).model_dump()

        current_bid_amount, bid_count = bid_aggregates.get(item.id, (None, 0))
        item_dict["current_bid_amount"] = current_bid_amount
        item_dict["bid_count"] = bid_count
        item_dict["min_next_bid_amount"] = (
            current_bid_amount + item.bid_increment
            if current_bid_amount is not None
            else item.starting_bid + item.bid_increment
        )

        signed_media: list[dict[str, object]] = []
        primary_image_url: str | None = None
        for media in media_by_item_id.get(item.id, []):
            media_dict = MediaResponse.model_validate(media, from_attributes=True).model_dump()
            signed_file_path = _get_signed_auction_asset_url(
                media.file_path,
                media_service,
                container_path,
            )
            signed_thumbnail_path = _get_signed_auction_asset_url(
                media.thumbnail_path,
                media_service,
                container_path,
            )

            media_dict["file_path"] = signed_file_path or media.file_path
            media_dict["thumbnail_path"] = signed_thumbnail_path or media.thumbnail_path

            if primary_image_url is None and media.media_type == "image":
                primary_image_url = media_dict["file_path"]

            signed_media.append(media_dict)

        item_dict["primary_image_url"] = primary_image_url
        item_dict["media"] = signed_media
        preview_items.append(AuctionItemDetail(**item_dict))

    return preview_items


# --- Admin endpoint: generate preview token ---

admin_router = APIRouter(
    prefix="/admin/events",
    tags=["admin-preview"],
)


@admin_router.post(
    "/{event_id}/preview-token",
    response_model=PreviewTokenResponse,
    summary="Generate a preview token for an event",
    description=(
        "Creates a short-lived JWT token (30-minute expiry) that grants "
        "read-only access to view an event as a donor would see it, "
        "regardless of whether the event is published or still in draft."
    ),
)
async def create_event_preview_token(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> PreviewTokenResponse:
    """Generate a preview token for an event.

    Only admins / event coordinators can generate preview tokens.
    The token can be used to view the event in the donor PWA,
    even if it is in draft status.
    """
    # Verify the event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Check role — only admin-level roles may generate preview tokens
    allowed_roles = {"super_admin", "npo_admin", "event_coordinator", "staff"}
    if current_user.role_name not in allowed_roles:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to preview this event",
        )

    if current_user.role_name != "super_admin":  # type: ignore[attr-defined]
        permission_service = PermissionService()
        if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to preview this event",
            )

    expires_delta = timedelta(minutes=30)
    token = create_preview_token(
        event_id=str(event_id),
        admin_user_id=str(current_user.id),
        expires_delta=expires_delta,
    )
    expires_at = datetime.utcnow() + expires_delta

    logger.info(
        "Preview token generated for event %s by user %s",
        event_id,
        current_user.id,
    )

    return PreviewTokenResponse(
        token=token,
        event_id=event_id,
        expires_at=expires_at,
    )


# --- Public endpoint: fetch event data using preview token ---

preview_router = APIRouter(
    prefix="/events/preview",
    tags=["event-preview"],
)


@preview_router.get(
    "/{event_id}",
    response_model=PreviewEventResponse,
    summary="Get event preview data",
    description=(
        "Returns bundled event data (event details + auction items + sponsors) "
        "for rendering the full donor experience in preview mode. "
        "Requires a valid preview token. Works for events in any status "
        "(draft, active, closed)."
    ),
)
async def get_event_preview(
    event_id: uuid.UUID,
    token: Annotated[str, Query(description="Preview JWT token")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PreviewEventResponse:
    """Fetch bundled event data for donor preview.

    Validates the preview token and returns event details,
    auction items, and sponsors in a single response.
    """
    # Decode and validate the preview token
    try:
        claims = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Preview token has expired. Please generate a new one.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid preview token.",
        )

    # Validate token type
    if claims.get("type") != "preview":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Expected a preview token.",
        )

    # Validate event_id matches the token
    token_event_id = claims.get("event_id")
    if token_event_id != str(event_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Preview token is not valid for this event.",
        )

    # Fetch event (no status filter — allows draft/closed preview)
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    event_dict = EventDetailResponse.model_validate(event, from_attributes=True).model_dump()
    event_dict["npo_name"] = event.npo.name if event.npo else None
    _add_sas_urls_to_media(event_dict)
    event_response = EventDetailResponse(**event_dict)

    auction_items = await _build_preview_auction_items(db, event_id)

    # Fetch sponsors
    sponsors_raw = await SponsorService.get_sponsors_for_event(db, event_id)
    sponsors = [
        SponsorResponse(
            id=s.id,
            event_id=s.event_id,
            name=s.name,
            logo_url=_get_sponsor_asset_url(s.logo_blob_name, s.logo_url) or s.logo_url or "",
            logo_blob_name=s.logo_blob_name,
            thumbnail_url=(
                _get_sponsor_asset_url(s.thumbnail_blob_name, s.thumbnail_url)
                or s.thumbnail_url
                or _get_sponsor_asset_url(s.logo_blob_name, s.logo_url)
                or s.logo_url
                or ""
            ),
            thumbnail_blob_name=s.thumbnail_blob_name,
            website_url=str(s.website_url) if s.website_url else None,
            logo_size=s.logo_size,
            sponsor_level=s.sponsor_level,
            contact_name=s.contact_name,
            contact_email=s.contact_email,
            contact_phone=s.contact_phone,
            address_line1=s.address_line1,
            address_line2=s.address_line2,
            city=s.city,
            state=s.state,
            postal_code=s.postal_code,
            country=s.country,
            donation_amount=s.donation_amount,
            notes=s.notes,
            display_order=s.display_order,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
            created_by=s.created_by,
        )
        for s in sponsors_raw
    ]

    logger.info(
        "Preview data served for event %s (token sub=%s): %d auction items, %d sponsors",
        event_id,
        claims.get("sub"),
        len(auction_items),
        len(sponsors),
    )

    return PreviewEventResponse(
        event=event_response,
        auction_items=auction_items,
        sponsors=sponsors,
    )
