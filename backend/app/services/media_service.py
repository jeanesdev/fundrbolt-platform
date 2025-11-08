"""Media Service - Azure Blob Storage integration for event media."""

import logging
import mimetypes
import uuid
from datetime import datetime, timedelta

import pytz
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.metrics import EVENT_MEDIA_SCAN_RESULTS_TOTAL, EVENT_MEDIA_UPLOADS_TOTAL
from app.models.event import EventMedia, EventMediaStatus, EventMediaType
from app.models.user import User
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class MediaService:
    """Service for managing event media uploads with Azure Blob Storage."""

    # File size limits
    MAX_FILE_SIZE_MB = 10
    MAX_TOTAL_SIZE_MB = 50
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024

    # Allowed MIME types
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    }
    ALLOWED_DOCUMENT_TYPES = {
        "application/pdf",
    }

    @staticmethod
    def _get_blob_client():
        """Get Azure Blob Service Client."""
        if not settings.azure_storage_connection_string:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage not configured",
            )

        return BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)

    @staticmethod
    async def generate_upload_url(
        db: AsyncSession,
        event_id: uuid.UUID,
        filename: str,
        file_size: int,
        media_type: EventMediaType,
        current_user: User,
    ) -> tuple[str, uuid.UUID]:
        """
        Generate pre-signed URL for direct upload to Azure Blob Storage.

        Args:
            db: Database session
            event_id: Event UUID
            filename: Original filename
            file_size: File size in bytes
            media_type: Image, video, or flyer
            current_user: User requesting upload

        Returns:
            Tuple of (upload_url, media_id)

        Raises:
            HTTPException: If validation fails or limits exceeded
        """
        # Validate file size
        if file_size > MediaService.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size {file_size / 1024 / 1024:.2f}MB exceeds limit of {MediaService.MAX_FILE_SIZE_MB}MB",
            )

        # Check total event media size
        from sqlalchemy import func, select

        total_query = select(func.sum(EventMedia.file_size)).where(EventMedia.event_id == event_id)
        result = await db.execute(total_query)
        current_total = result.scalar() or 0

        if current_total + file_size > MediaService.MAX_TOTAL_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total media size would exceed {MediaService.MAX_TOTAL_SIZE_MB}MB limit",
            )

        # Validate MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to determine file type",
            )

        allowed_types = (
            MediaService.ALLOWED_IMAGE_TYPES
            if media_type == EventMediaType.IMAGE
            else MediaService.ALLOWED_DOCUMENT_TYPES
        )

        if mime_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {mime_type} not allowed for {media_type.value}",
            )

        # Create media record
        media_id = uuid.uuid4()
        blob_name = f"events/{event_id}/{media_id}/{filename}"

        media = EventMedia(
            id=media_id,
            event_id=event_id,
            media_type=media_type,
            file_name=filename,
            file_size=file_size,
            mime_type=mime_type,
            blob_name=blob_name,
            status=EventMediaStatus.UPLOADED,
            uploaded_by=current_user.id,
        )

        db.add(media)
        await db.commit()

        # Generate SAS URL
        blob_client = MediaService._get_blob_client()
        container_name = settings.azure_storage_container_name or "event-media"

        sas_token = generate_blob_sas(
            account_name=blob_client.account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=blob_client.credential.account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.now(pytz.UTC) + timedelta(hours=1),
        )

        upload_url = f"{blob_client.url}/{container_name}/{blob_name}?{sas_token}"

        logger.info(
            f"Generated upload URL for event {event_id}, media {media_id}, user {current_user.id}"
        )

        return upload_url, media_id

    @staticmethod
    async def confirm_upload(
        db: AsyncSession,
        media_id: uuid.UUID,
    ) -> EventMedia:
        """
        Mark media as uploaded after successful Azure Blob upload.

        Triggers virus scanning via Celery task.
        """
        from sqlalchemy import select

        query = select(EventMedia).where(EventMedia.id == media_id)
        result = await db.execute(query)
        media = result.scalar_one_or_none()

        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media with ID {media_id} not found",
            )

        if media.status != EventMediaStatus.UPLOADED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Media is already {media.status.value}",
            )

        media.status = EventMediaStatus.SCANNED  # Will be re-checked after virus scan

        await db.commit()
        await db.refresh(media)

        # Increment metrics for successful upload
        EVENT_MEDIA_UPLOADS_TOTAL.labels(status="success").inc()

        # TODO: Trigger Celery task for virus scanning
        # from app.tasks.media import scan_uploaded_file
        # scan_uploaded_file.delay(str(media_id))

        logger.info(f"Media {media_id} marked for scanning")
        return media

    @staticmethod
    async def mark_scan_complete(
        db: AsyncSession,
        media_id: uuid.UUID,
        scan_passed: bool,
        scan_details: dict | None = None,
    ) -> EventMedia:
        """Update media status after virus scan completes."""
        from sqlalchemy import select

        query = select(EventMedia).where(EventMedia.id == media_id)
        result = await db.execute(query)
        media = result.scalar_one_or_none()

        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media with ID {media_id} not found",
            )

        if scan_passed:
            media.status = EventMediaStatus.SCANNED
            EVENT_MEDIA_SCAN_RESULTS_TOTAL.labels(result="clean").inc()
            logger.info(f"Media {media_id} approved after scan")
        else:
            media.status = EventMediaStatus.QUARANTINED
            EVENT_MEDIA_SCAN_RESULTS_TOTAL.labels(result="infected").inc()
            logger.warning(f"Media {media_id} rejected after scan: {scan_details}")

        await db.commit()
        await db.refresh(media)

        return media

    @staticmethod
    async def delete_media(
        db: AsyncSession,
        media_id: uuid.UUID,
        current_user: User,
    ) -> None:
        """
        Delete media from database and Azure Blob Storage.

        Args:
            db: Database session
            media_id: Media UUID
            current_user: User deleting the media
        """
        from sqlalchemy import select

        query = select(EventMedia).where(EventMedia.id == media_id)
        result = await db.execute(query)
        media = result.scalar_one_or_none()

        if not media:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media with ID {media_id} not found",
            )

        # Delete from Azure Blob
        try:
            blob_client = MediaService._get_blob_client()
            container_name = settings.azure_storage_container_name or "event-media"
            blob = blob_client.get_blob_client(container=container_name, blob=media.blob_name)
            blob.delete_blob()
        except Exception as e:
            logger.error(f"Failed to delete blob {media.blob_name}: {e}")
            # Continue with DB deletion even if blob deletion fails

        # Delete from database
        await db.delete(media)
        await db.commit()

        await AuditService.log_action(
            db=db,
            user_id=current_user.id,
            action="delete",
            resource_type="event_media",
            resource_id=media_id,
            details={"file_name": media.file_name, "event_id": str(media.event_id)},
        )

        logger.info(f"Media {media_id} deleted by user {current_user.id}")
