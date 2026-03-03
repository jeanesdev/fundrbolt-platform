"""Event Media API endpoints."""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Annotated

import pytz
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event import EventMedia, EventMediaType, EventMediaUsageTag
from app.models.user import User
from app.schemas.event import (
    EventMediaResponse,
    MediaUpdateRequest,
    MediaUploadUrlRequest,
    MediaUploadUrlResponse,
)
from app.services.event_service import EventService
from app.services.media_service import MediaService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/media", tags=["events", "media"])


@router.post("/upload", response_model=EventMediaResponse, status_code=status.HTTP_200_OK)
async def upload_media_direct(
    event_id: uuid.UUID,
    file: Annotated[UploadFile, File(...)],
    media_type: Annotated[str, Form(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    usage_tag: Annotated[EventMediaUsageTag, Form()] = EventMediaUsageTag.MAIN_EVENT_PAGE_HERO,
) -> EventMediaResponse:
    """Upload media directly through backend (fallback for client-side upload fetch failures)."""
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    try:
        media_type_enum = EventMediaType(media_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid media type: {media_type}. Must be one of: image, video, flyer",
        )

    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload.bin"

    media = await MediaService.upload_file_direct(
        db=db,
        event_id=event_id,
        filename=filename,
        file_bytes=content,
        content_type=content_type,
        media_type=media_type_enum,
        usage_tag=usage_tag,
        current_user=current_user,
    )

    file_url = media.file_url
    if media.blob_name:
        file_url = MediaService.generate_read_sas_url(media.blob_name)

    return EventMediaResponse(
        id=media.id,
        event_id=media.event_id,
        media_type=media.media_type.value,
        usage_tag=media.usage_tag,
        file_name=media.file_name,
        file_url=file_url,
        file_type=media.file_type,
        mime_type=media.mime_type,
        file_size=media.file_size,
        display_order=media.display_order,
        status=media.status,
        created_at=media.created_at,
        uploaded_by=media.uploaded_by,
    )


@router.post("/upload-url", response_model=MediaUploadUrlResponse, status_code=status.HTTP_200_OK)
async def request_upload_url(
    event_id: uuid.UUID,
    request: MediaUploadUrlRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> MediaUploadUrlResponse:
    """
    Generate pre-signed URL for uploading media to Azure Blob Storage.

    Workflow:
    1. Request upload URL with file metadata
    2. Upload file to pre-signed URL (client-side)
    3. Call confirm endpoint to finalize upload

    Returns:
    - upload_url: Pre-signed Azure Blob URL (1-hour expiry)
    - media_id: UUID of created EventMedia record
    - expires_at: Upload URL expiration timestamp
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Convert string media_type to enum
    try:
        media_type_enum = EventMediaType(request.media_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid media type: {request.media_type}. Must be one of: image, video, flyer",
        )

    # Generate upload URL
    upload_url, media_id = await MediaService.generate_upload_url(
        db=db,
        event_id=event_id,
        filename=request.file_name,
        file_size=request.file_size,
        media_type=media_type_enum,
        usage_tag=request.usage_tag,
        current_user=current_user,
    )

    # URL expires in 1 hour
    expires_at = datetime.now(pytz.UTC) + timedelta(hours=1)

    return MediaUploadUrlResponse(
        upload_url=upload_url,
        media_id=media_id,
        expires_at=expires_at,
    )


@router.post(
    "/{media_id}/confirm", response_model=EventMediaResponse, status_code=status.HTTP_200_OK
)
async def confirm_upload(
    event_id: uuid.UUID,
    media_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventMediaResponse:
    """
    Confirm media upload completion and trigger virus scan.

    Call this after successfully uploading file to Azure Blob Storage.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Confirm upload
    media = await MediaService.confirm_upload(db=db, media_id=media_id)

    # Generate SAS URL for read access
    file_url = media.file_url
    if media.blob_name:
        file_url = MediaService.generate_read_sas_url(media.blob_name)

    return EventMediaResponse(
        id=media.id,
        event_id=media.event_id,
        media_type=media.media_type.value,
        usage_tag=media.usage_tag,
        file_name=media.file_name,
        file_url=file_url,
        file_type=media.file_type,
        mime_type=media.mime_type,
        file_size=media.file_size,
        display_order=media.display_order,
        status=media.status,
        created_at=media.created_at,  # Fixed: changed from uploaded_at
        uploaded_by=media.uploaded_by,
    )


@router.patch("/{media_id}", response_model=EventMediaResponse, status_code=status.HTTP_200_OK)
async def update_media(
    event_id: uuid.UUID,
    media_id: uuid.UUID,
    request: MediaUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> EventMediaResponse:
    """Update event media metadata (usage tag and/or display order)."""
    del current_user

    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    media_stmt = select(EventMedia).where(
        EventMedia.id == media_id,
        EventMedia.event_id == event_id,
    )
    media_result = await db.execute(media_stmt)
    media = media_result.scalar_one_or_none()
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media with ID {media_id} not found for event {event_id}",
        )

    if request.display_order is not None:
        media.display_order = request.display_order
    if request.usage_tag is not None:
        media.usage_tag = request.usage_tag

    await db.commit()
    await db.refresh(media)

    file_url = media.file_url
    if media.blob_name:
        file_url = MediaService.generate_read_sas_url(media.blob_name)

    return EventMediaResponse(
        id=media.id,
        event_id=media.event_id,
        media_type=media.media_type.value,
        usage_tag=media.usage_tag,
        file_name=media.file_name,
        file_url=file_url,
        file_type=media.file_type,
        mime_type=media.mime_type,
        file_size=media.file_size,
        display_order=media.display_order,
        status=media.status,
        created_at=media.created_at,
        uploaded_by=media.uploaded_by,
    )


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    event_id: uuid.UUID,
    media_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """
    Delete media file.

    Removes file from Azure Blob Storage and database record.
    """
    # Verify event exists
    event = await EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )

    # Delete media
    await MediaService.delete_media(db=db, media_id=media_id, current_user=current_user)
