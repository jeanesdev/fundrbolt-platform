"""Admin API endpoints for Revenue Generator items."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Annotated

import pytz
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.revenue_generator_item import RevenueGeneratorItem
from app.models.user import User
from app.schemas.revenue_generator import (
    ManualWinnerSelectRequest,
    RevenueGeneratorAdminListResponse,
    RevenueGeneratorEntryListResponse,
    RevenueGeneratorItemAdminResponse,
    RevenueGeneratorItemCreate,
    RevenueGeneratorItemUpdate,
    WinnerHistoryResponse,
    WinnerSelectionResponse,
)
from app.services.permission_service import PermissionService
from app.services.revenue_generator_service import RevenueGeneratorService

router = APIRouter(tags=["admin-revenue-generators"])


# ─── Image upload schemas ─────────────────────────────────────────────────────


class RGImageUploadUrlRequest(BaseModel):
    file_name: str
    file_type: str
    file_size: int


class RGImageUploadUrlResponse(BaseModel):
    upload_url: str
    blob_name: str
    expires_at: str


class RGImageConfirmRequest(BaseModel):
    blob_name: str
    file_name: str


async def _require_event_access(
    db: AsyncSession,
    current_user: User,
    event_id: uuid.UUID,
) -> None:
    from sqlalchemy import select

    from app.models.event import Event

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    permission_service = PermissionService()
    if not await permission_service.can_view_event(current_user, event.npo_id, db=db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def _get_item_or_404(
    db: AsyncSession, item_id: uuid.UUID, event_id: uuid.UUID
) -> RevenueGeneratorItem:
    from sqlalchemy import select

    result = await db.execute(
        select(RevenueGeneratorItem).where(
            RevenueGeneratorItem.id == item_id,
            RevenueGeneratorItem.event_id == event_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Revenue generator item not found"
        )
    return item


# ─── Item Endpoints ───────────────────────────────────────────────────────────


@router.get(
    "/admin/events/{event_id}/revenue-generators",
    response_model=RevenueGeneratorAdminListResponse,
)
async def list_revenue_generator_items(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorAdminListResponse:
    """List all revenue generator items for an event."""
    await _require_event_access(db, current_user, event_id)
    return await RevenueGeneratorService.list_items_admin(db, event_id)


@router.post(
    "/admin/events/{event_id}/revenue-generators",
    response_model=RevenueGeneratorItemAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_revenue_generator_item(
    event_id: uuid.UUID,
    data: RevenueGeneratorItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorItemAdminResponse:
    """Create a new revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    result = await RevenueGeneratorService.create_item(db, event_id, data, current_user.id)
    await db.commit()
    return result


@router.patch(
    "/admin/events/{event_id}/revenue-generators/{item_id}",
    response_model=RevenueGeneratorItemAdminResponse,
)
async def update_revenue_generator_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: RevenueGeneratorItemUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorItemAdminResponse:
    """Update a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    item = await _get_item_or_404(db, item_id, event_id)
    result = await RevenueGeneratorService.update_item(db, item, data)
    await db.commit()
    return result


@router.delete(
    "/admin/events/{event_id}/revenue-generators/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_revenue_generator_item(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    item = await _get_item_or_404(db, item_id, event_id)
    await RevenueGeneratorService.delete_item(db, item)
    await db.commit()


# ─── Entry Endpoints ──────────────────────────────────────────────────────────


@router.get(
    "/admin/events/{event_id}/revenue-generators/{item_id}/entries",
    response_model=RevenueGeneratorEntryListResponse,
)
async def list_entries(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=200)] = 50,
) -> RevenueGeneratorEntryListResponse:
    """List all entries (grouped by bidder) for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    return await RevenueGeneratorService.list_entries_admin(db, item_id, page, per_page)


# ─── Winner Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/admin/events/{event_id}/revenue-generators/{item_id}/draw-winner",
    response_model=WinnerSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def draw_random_winner(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WinnerSelectionResponse:
    """Draw a random winner for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    try:
        result = await RevenueGeneratorService.draw_random_winner(db, item_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    await db.commit()
    return result


@router.post(
    "/admin/events/{event_id}/revenue-generators/{item_id}/select-winner",
    response_model=WinnerSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def select_manual_winner(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ManualWinnerSelectRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WinnerSelectionResponse:
    """Manually select a winner for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    try:
        result = await RevenueGeneratorService.select_manual_winner(
            db, item_id, data, current_user.id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    await db.commit()
    return result


@router.get(
    "/admin/events/{event_id}/revenue-generators/{item_id}/winner-history",
    response_model=WinnerHistoryResponse,
)
async def get_winner_history(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WinnerHistoryResponse:
    """Get winner selection history for a revenue generator item."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)
    return await RevenueGeneratorService.get_winner_history(db, item_id)


# ─── Image Endpoints ──────────────────────────────────────────────────────────


def _generate_rg_blob_name(item_id: uuid.UUID, file_name: str) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    hash_input = f"{item_id}{timestamp}{file_name}".encode()
    file_hash = hashlib.sha256(hash_input).hexdigest()[:8]
    safe_name = "".join(c if c.isalnum() or c in ".-_" else "_" for c in file_name)
    return f"revenue-generators/{item_id}/{timestamp}_{file_hash}_{safe_name}"


@router.post(
    "/admin/events/{event_id}/revenue-generators/{item_id}/image/upload-url",
    response_model=RGImageUploadUrlResponse,
)
async def get_rg_image_upload_url(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    request: RGImageUploadUrlRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RGImageUploadUrlResponse:
    """Generate a pre-signed SAS URL for uploading a revenue generator item image."""
    await _require_event_access(db, current_user, event_id)
    await _get_item_or_404(db, item_id, event_id)

    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    max_size = 10 * 1024 * 1024  # 10 MB

    if request.file_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(sorted(allowed_types))}",
        )
    if request.file_size <= 0 or request.file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be between 1 byte and 10 MB",
        )

    from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas

    from app.core.config import get_settings

    settings = get_settings()
    if not settings.azure_storage_connection_string:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure Storage not configured",
        )

    blob_name = _generate_rg_blob_name(item_id, request.file_name)
    container_name = settings.azure_storage_container_name or "event-media"

    blob_service_client = BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string
    )
    account_name = blob_service_client.account_name
    account_key = getattr(blob_service_client.credential, "account_key", None)

    if not account_name or not account_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure Storage credentials not available",
        )

    expiry = datetime.now(pytz.UTC) + timedelta(hours=1)
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=container_name,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(write=True, create=True),
        expiry=expiry,
    )
    base_url = f"https://{account_name}.blob.core.windows.net"
    upload_url = f"{base_url}/{container_name}/{blob_name}?{sas_token}"

    return RGImageUploadUrlResponse(
        upload_url=upload_url,
        blob_name=blob_name,
        expires_at=expiry.isoformat(),
    )


@router.post(
    "/admin/events/{event_id}/revenue-generators/{item_id}/image/confirm",
    response_model=RevenueGeneratorItemAdminResponse,
)
async def confirm_rg_image_upload(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    request: RGImageConfirmRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevenueGeneratorItemAdminResponse:
    """Confirm image upload and save the blob reference on the item."""
    await _require_event_access(db, current_user, event_id)
    item = await _get_item_or_404(db, item_id, event_id)

    from app.core.config import get_settings
    from app.services.sponsor_logo_service import SponsorLogoService

    settings = get_settings()
    container_name = settings.azure_storage_container_name or "event-media"
    account_name = settings.azure_storage_account_name or ""

    # Store plain (non-SAS) URL and the blob name
    base_url = f"https://{account_name}.blob.core.windows.net"
    image_url = f"{base_url}/{container_name}/{request.blob_name}"

    item.image_url = image_url
    item.image_blob_name = request.blob_name
    await db.flush()
    await db.commit()

    # Return fresh SAS URL
    try:
        signed_url = SponsorLogoService.generate_blob_sas_url(request.blob_name, expiry_hours=24)
    except Exception:
        signed_url = image_url

    entry_stats = await RevenueGeneratorService._get_entry_stats(db, item.id)
    winner = await RevenueGeneratorService._get_current_winner(db, item.id)
    return RevenueGeneratorItemAdminResponse(
        id=item.id,
        event_id=item.event_id,
        name=item.name,
        description=item.description,
        post_purchase_instructions=item.post_purchase_instructions,
        price_per_entry=item.price_per_entry,
        max_entries=item.max_entries,
        max_entries_per_person=item.max_entries_per_person,
        image_url=signed_url,
        is_visible=item.is_visible,
        is_open_for_entries=item.is_open_for_entries,
        display_order=item.display_order,
        total_entries=entry_stats[0],
        total_revenue=entry_stats[1],
        current_winner_name=winner[0] if winner else None,
        current_winner_bidder_number=winner[1] if winner else None,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.delete(
    "/admin/events/{event_id}/revenue-generators/{item_id}/image",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_rg_image(
    event_id: uuid.UUID,
    item_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove the image from a revenue generator item (optionally deletes the blob)."""
    await _require_event_access(db, current_user, event_id)
    item = await _get_item_or_404(db, item_id, event_id)

    # Best-effort blob deletion
    if item.image_blob_name:
        try:
            from azure.storage.blob import BlobServiceClient

            from app.core.config import get_settings

            settings = get_settings()
            if settings.azure_storage_connection_string:
                client = BlobServiceClient.from_connection_string(
                    settings.azure_storage_connection_string
                )
                container = settings.azure_storage_container_name or "event-media"
                blob_client = client.get_blob_client(container=container, blob=item.image_blob_name)
                blob_client.delete_blob(delete_snapshots="include")
        except Exception:
            pass  # Non-fatal: record is removed regardless

    item.image_url = None
    item.image_blob_name = None
    await db.flush()
    await db.commit()
