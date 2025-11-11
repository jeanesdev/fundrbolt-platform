"""Event Media API endpoints."""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Annotated

import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.event import EventMediaType
from app.models.user import User
from app.schemas.event import (
    EventMediaResponse,
    MediaUploadUrlRequest,
    MediaUploadUrlResponse,
)
from app.services.event_service import EventService
from app.services.media_service import MediaService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/media", tags=["events", "media"])


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

    return EventMediaResponse(
        id=media.id,
        event_id=media.event_id,
        media_type=media.media_type.value,
        file_name=media.file_name,
        file_url=media.file_url,
        file_type=media.file_type,
        mime_type=media.mime_type,
        file_size=media.file_size,
        display_order=media.display_order,
        status=media.status,
        uploaded_at=media.created_at,
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
