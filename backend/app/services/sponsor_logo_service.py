"""Sponsor Logo Service - Azure Blob Storage integration for sponsor logos."""

import hashlib
import logging
import uuid
from datetime import datetime, timedelta
from io import BytesIO

import pytz
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from fastapi import HTTPException, status
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.sponsor import Sponsor

settings = get_settings()
logger = logging.getLogger(__name__)


class SponsorLogoService:
    """Service for managing sponsor logo uploads with Azure Blob Storage."""

    # File size limits for sponsor logos (5MB max)
    MAX_FILE_SIZE_MB = 5
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

    # Allowed MIME types for sponsor logos
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/svg+xml",
        "image/webp",
    }

    # Image dimensions
    MIN_WIDTH = 64
    MIN_HEIGHT = 64
    MAX_WIDTH = 2048
    MAX_HEIGHT = 2048

    # Thumbnail size
    THUMBNAIL_SIZE = (128, 128)

    # SAS URL expiration
    SAS_EXPIRY_HOURS = 1

    @staticmethod
    def _get_blob_client() -> BlobServiceClient:
        """Get Azure Blob Service Client."""
        if not settings.azure_storage_connection_string:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage not configured",
            )

        return BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)

    @staticmethod
    def validate_logo_file(
        file_type: str,
        file_size: int,
    ) -> tuple[bool, str | None]:
        """
        Validate sponsor logo file metadata.

        Args:
            file_type: MIME type
            file_size: File size in bytes

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check MIME type
        if file_type not in SponsorLogoService.ALLOWED_IMAGE_TYPES:
            return (
                False,
                f"Invalid file type. Allowed types: {', '.join(SponsorLogoService.ALLOWED_IMAGE_TYPES)}",
            )

        # Check file size
        if file_size > SponsorLogoService.MAX_FILE_SIZE_BYTES:
            max_mb = SponsorLogoService.MAX_FILE_SIZE_BYTES / (1024 * 1024)
            return False, f"File size exceeds {max_mb}MB limit"

        if file_size <= 0:
            return False, "File size must be greater than 0"

        return True, None

    @staticmethod
    def generate_blob_name(npo_id: uuid.UUID, sponsor_id: uuid.UUID, file_name: str) -> str:
        """
        Generate a unique blob name for the sponsor logo.

        Args:
            npo_id: NPO ID
            sponsor_id: Sponsor ID
            file_name: Original file name

        Returns:
            Blob name in format: sponsors/{npo_id}/{sponsor_id}/{timestamp}_{hash}_{filename}
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        hash_input = f"{npo_id}{sponsor_id}{timestamp}{file_name}".encode()
        file_hash = hashlib.sha256(hash_input).hexdigest()[:8]

        # Sanitize filename
        safe_filename = "".join(c if c.isalnum() or c in ".-_" else "_" for c in file_name)

        return f"sponsors/{npo_id}/{sponsor_id}/{timestamp}_{file_hash}_{safe_filename}"

    @staticmethod
    async def generate_upload_url(
        db: AsyncSession,
        sponsor_id: uuid.UUID,
        npo_id: uuid.UUID,
        file_name: str,
        file_type: str,
        file_size: int,
    ) -> tuple[str, str]:
        """
        Generate pre-signed SAS URL for direct upload to Azure Blob Storage.

        Args:
            db: Database session
            sponsor_id: Sponsor UUID
            npo_id: NPO ID for folder organization
            file_name: Original filename
            file_type: MIME type
            file_size: File size in bytes

        Returns:
            Tuple of (upload_url, expires_at_iso)

        Raises:
            HTTPException: If validation fails
        """
        # Validate file
        is_valid, error_msg = SponsorLogoService.validate_logo_file(file_type, file_size)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )

        # Generate blob name
        blob_name = SponsorLogoService.generate_blob_name(npo_id, sponsor_id, file_name)
        container_name = settings.azure_storage_container_name or "event-media"

        # Get blob client and account key
        blob_service_client = SponsorLogoService._get_blob_client()
        account_name = blob_service_client.account_name

        if not account_name:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage account not configured",
            )

        # Get account key from credential
        account_key = None
        if hasattr(blob_service_client.credential, "account_key"):
            account_key = blob_service_client.credential.account_key

        if not account_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Azure Storage account key not available",
            )

        # Generate SAS token with write permission
        expiry = datetime.now(pytz.UTC) + timedelta(hours=SponsorLogoService.SAS_EXPIRY_HOURS)
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expiry,
        )

        # Generate upload URL
        base_url = f"https://{account_name}.blob.core.windows.net"
        upload_url = f"{base_url}/{container_name}/{blob_name}?{sas_token}"

        logger.info(f"Generated upload URL for sponsor {sponsor_id} logo")

        return upload_url, expiry.isoformat()

    @staticmethod
    def generate_thumbnail(logo_blob_data: bytes) -> bytes:
        """
        Generate a thumbnail from logo image data.

        Args:
            logo_blob_data: Original logo image bytes

        Returns:
            Thumbnail image bytes (128x128 PNG)

        Raises:
            HTTPException: If thumbnail generation fails
        """
        try:
            image = Image.open(BytesIO(logo_blob_data))

            # For SVG or if image is already small, just return original
            if image.format == "SVG" or (
                image.width <= SponsorLogoService.THUMBNAIL_SIZE[0]
                and image.height <= SponsorLogoService.THUMBNAIL_SIZE[1]
            ):
                return logo_blob_data

            # Create thumbnail with aspect ratio preservation
            image.thumbnail(SponsorLogoService.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            # Save to bytes
            output = BytesIO()
            # Convert to RGB if necessary (for transparency handling)
            if image.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", image.size, (255, 255, 255))
                if image.mode == "P":
                    image = image.convert("RGBA")
                background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
                image = background

            image.save(output, format="PNG", optimize=True)
            return output.getvalue()

        except Exception as e:
            logger.error(f"Failed to generate thumbnail: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate thumbnail",
            )

    @staticmethod
    async def confirm_upload(
        db: AsyncSession,
        sponsor_id: uuid.UUID,
        logo_blob_name: str,
    ) -> Sponsor:
        """
        Confirm logo upload and generate thumbnail.

        This should be called after the client successfully uploads the logo to Azure.
        It will:
        1. Download the uploaded logo from Azure
        2. Generate a thumbnail
        3. Upload the thumbnail to Azure
        4. Update the sponsor record with logo and thumbnail URLs

        Args:
            db: Database session
            sponsor_id: Sponsor UUID
            logo_blob_name: Blob name of uploaded logo

        Returns:
            Updated sponsor with logo_url and thumbnail_url set

        Raises:
            HTTPException: If sponsor not found or upload confirmation fails
        """
        from sqlalchemy import select

        # Get sponsor
        query = select(Sponsor).where(Sponsor.id == sponsor_id)
        result = await db.execute(query)
        sponsor = result.scalar_one_or_none()

        if not sponsor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sponsor not found",
            )

        try:
            blob_service_client = SponsorLogoService._get_blob_client()
            container_name = settings.azure_storage_container_name or "event-media"
            blob_client = blob_service_client.get_blob_client(
                container=container_name, blob=logo_blob_name
            )

            # Download logo for thumbnail generation
            logo_data = blob_client.download_blob().readall()

            # Generate thumbnail
            thumbnail_data = SponsorLogoService.generate_thumbnail(logo_data)

            # Generate thumbnail blob name
            thumbnail_blob_name = logo_blob_name.replace(f"/{sponsor_id}/", f"/{sponsor_id}/thumb_")
            thumbnail_blob_client = blob_service_client.get_blob_client(
                container=container_name, blob=thumbnail_blob_name
            )

            # Upload thumbnail
            thumbnail_blob_client.upload_blob(thumbnail_data, overwrite=True)

            # Generate read URLs with SAS tokens
            from app.services.media_service import MediaService

            logo_url = MediaService.generate_read_sas_url(logo_blob_name, expiry_hours=24)
            thumbnail_url = MediaService.generate_read_sas_url(thumbnail_blob_name, expiry_hours=24)

            # Update sponsor
            sponsor.logo_url = logo_url
            sponsor.logo_blob_name = logo_blob_name
            sponsor.thumbnail_url = thumbnail_url
            sponsor.thumbnail_blob_name = thumbnail_blob_name
            sponsor.updated_at = datetime.utcnow()

            await db.commit()
            await db.refresh(sponsor)

            logger.info(f"Confirmed logo upload for sponsor {sponsor_id}")

            return sponsor

        except Exception as e:
            logger.error(f"Failed to confirm upload for sponsor {sponsor_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process logo upload: {str(e)}",
            )

    @staticmethod
    async def delete_logo_blobs(
        logo_blob_name: str | None,
        thumbnail_blob_name: str | None,
    ) -> None:
        """
        Delete logo and thumbnail blobs from Azure Storage.

        Args:
            logo_blob_name: Logo blob name
            thumbnail_blob_name: Thumbnail blob name
        """
        if not logo_blob_name and not thumbnail_blob_name:
            return

        try:
            blob_service_client = SponsorLogoService._get_blob_client()
            container_name = settings.azure_storage_container_name or "event-media"

            if logo_blob_name:
                blob_client = blob_service_client.get_blob_client(
                    container=container_name, blob=logo_blob_name
                )
                blob_client.delete_blob()
                logger.info(f"Deleted logo blob: {logo_blob_name}")

            if thumbnail_blob_name:
                thumbnail_client = blob_service_client.get_blob_client(
                    container=container_name, blob=thumbnail_blob_name
                )
                thumbnail_client.delete_blob()
                logger.info(f"Deleted thumbnail blob: {thumbnail_blob_name}")

        except Exception as e:
            # Log error but don't raise - blob deletion is cleanup, not critical
            logger.error(f"Failed to delete logo blobs: {str(e)}")
