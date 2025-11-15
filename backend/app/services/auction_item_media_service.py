"""Auction item media service for Azure Blob Storage with image/video management.

This service handles:
- Image/video uploads for auction items
- Thumbnail generation for images (200x200 and 800x600)
- Image validation (type, size, dimensions)
- Video validation (type, size)
- Azure Blob Storage SAS URL generation
- Media reordering (drag-drop)
- Media deletion
"""

import hashlib
import uuid
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from typing import Any

from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    ContentSettings,
    generate_blob_sas,
)
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.auction_item import AuctionItemMedia


class AuctionItemMediaService:
    """Service for handling auction item media uploads and management."""

    blob_service_client: BlobServiceClient | None

    # Allowed image MIME types
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    }

    # Allowed video MIME types
    ALLOWED_VIDEO_TYPES = {
        "video/mp4",
        "video/webm",
        "video/quicktime",  # .mov files
    }

    # Allowed file extensions
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}

    # Maximum file sizes
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB

    # Image dimension limits
    MAX_IMAGE_WIDTH = 4000
    MAX_IMAGE_HEIGHT = 4000
    MIN_IMAGE_WIDTH = 200
    MIN_IMAGE_HEIGHT = 200

    # Thumbnail sizes
    THUMBNAIL_SMALL = (200, 200)  # Grid/card view
    THUMBNAIL_LARGE = (800, 600)  # Detail view

    # Media count limits per auction item
    MAX_IMAGES_PER_ITEM = 20
    MAX_VIDEOS_PER_ITEM = 5

    # SAS URL expiration (15 minutes for upload)
    SAS_EXPIRY_HOURS = 0.25  # 15 minutes

    def __init__(self, settings: Settings, db: AsyncSession):
        """Initialize the auction item media service.

        Args:
            settings: Application settings containing Azure credentials
            db: Database session
        """
        self.settings = settings
        self.db = db
        self.container_name = settings.azure_storage_container_name

        # Initialize blob service client if connection string is provided
        if settings.azure_storage_connection_string:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                settings.azure_storage_connection_string
            )
        else:
            self.blob_service_client = None

        # Local storage directory (used when Azure is not configured)
        self.local_storage_dir = Path("static/uploads/auction-items")
        self.local_storage_dir.mkdir(parents=True, exist_ok=True)

    def _generate_blob_sas_url(self, blob_name: str, expiry_hours: float = 24.0) -> str:
        """Generate a SAS URL with read permissions for a blob.

        Args:
            blob_name: Name of the blob in Azure Storage
            expiry_hours: Hours until SAS URL expires (default 24 hours)

        Returns:
            Full blob URL with SAS token for read access

        Raises:
            ValueError: If Azure Blob Storage is not configured
        """
        if not self.blob_service_client or not self.settings.azure_storage_account_name:
            raise ValueError("Azure Blob Storage not configured")

        if not self.settings.azure_storage_connection_string:
            raise ValueError("Azure storage connection string not configured")

        # Extract account key from connection string
        conn_str = self.settings.azure_storage_connection_string
        try:
            account_key = conn_str.split("AccountKey=")[1].split(";")[0]
        except (IndexError, AttributeError) as e:
            raise ValueError("Invalid Azure storage connection string format") from e

        # Generate SAS token
        sas_token = generate_blob_sas(
            account_name=self.settings.azure_storage_account_name,
            container_name=self.container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=expiry_hours),
        )

        # Get blob URL and append SAS token
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )
        return f"{blob_client.url}?{sas_token}"

    def _validate_file_type(
        self, content_type: str, file_name: str, media_type: str
    ) -> tuple[bool, str | None]:
        """Validate file type based on media type.

        Args:
            content_type: MIME type
            file_name: Original file name
            media_type: 'image' or 'video'

        Returns:
            Tuple of (is_valid, error_message)
        """
        if media_type == "image":
            # Check MIME type
            if content_type not in self.ALLOWED_IMAGE_TYPES:
                return (
                    False,
                    f"Invalid image type. Allowed: {', '.join(self.ALLOWED_IMAGE_TYPES)}",
                )

            # Check file extension
            file_ext = "." + file_name.lower().split(".")[-1] if "." in file_name else ""
            if file_ext not in self.ALLOWED_IMAGE_EXTENSIONS:
                return (
                    False,
                    f"Invalid image extension. Allowed: {', '.join(self.ALLOWED_IMAGE_EXTENSIONS)}",
                )

        elif media_type == "video":
            # Check MIME type
            if content_type not in self.ALLOWED_VIDEO_TYPES:
                return (
                    False,
                    f"Invalid video type. Allowed: {', '.join(self.ALLOWED_VIDEO_TYPES)}",
                )

            # Check file extension
            file_ext = "." + file_name.lower().split(".")[-1] if "." in file_name else ""
            if file_ext not in self.ALLOWED_VIDEO_EXTENSIONS:
                return (
                    False,
                    f"Invalid video extension. Allowed: {', '.join(self.ALLOWED_VIDEO_EXTENSIONS)}",
                )

        else:
            return False, f"Invalid media type: {media_type}. Must be 'image' or 'video'"

        return True, None

    def _validate_file_size(self, file_size: int, media_type: str) -> tuple[bool, str | None]:
        """Validate file size based on media type.

        Args:
            file_size: File size in bytes
            media_type: 'image' or 'video'

        Returns:
            Tuple of (is_valid, error_message)
        """
        if file_size <= 0:
            return False, "File size must be greater than 0"

        if media_type == "image":
            if file_size > self.MAX_IMAGE_SIZE:
                max_mb = self.MAX_IMAGE_SIZE / (1024 * 1024)
                return False, f"Image size exceeds {max_mb}MB limit"

        elif media_type == "video":
            if file_size > self.MAX_VIDEO_SIZE:
                max_mb = self.MAX_VIDEO_SIZE / (1024 * 1024)
                return False, f"Video size exceeds {max_mb}MB limit"

        else:
            return False, f"Invalid media type: {media_type}"

        return True, None

    def _validate_image_dimensions(
        self, file_content: bytes
    ) -> tuple[bool, str | None, tuple[int, int] | None]:
        """Validate image dimensions using PIL.

        Args:
            file_content: Image file content as bytes

        Returns:
            Tuple of (is_valid, error_message, dimensions)
            dimensions is (width, height) tuple or None if invalid
        """
        try:
            image = Image.open(BytesIO(file_content))
            width, height = image.size

            # Check minimum dimensions
            if width < self.MIN_IMAGE_WIDTH or height < self.MIN_IMAGE_HEIGHT:
                return (
                    False,
                    f"Image too small. Minimum: {self.MIN_IMAGE_WIDTH}x{self.MIN_IMAGE_HEIGHT}px",
                    None,
                )

            # Check maximum dimensions
            if width > self.MAX_IMAGE_WIDTH or height > self.MAX_IMAGE_HEIGHT:
                return (
                    False,
                    f"Image too large. Maximum: {self.MAX_IMAGE_WIDTH}x{self.MAX_IMAGE_HEIGHT}px",
                    None,
                )

            return True, None, (width, height)

        except Exception as e:
            return False, f"Invalid image file: {str(e)}", None

    async def _validate_media_count(
        self, auction_item_id: uuid.UUID, media_type: str
    ) -> tuple[bool, str | None]:
        """Validate that media count doesn't exceed limits.

        Args:
            auction_item_id: Auction item ID
            media_type: 'image' or 'video'

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Count existing media of this type
        from sqlalchemy import func, select

        stmt = select(func.count(AuctionItemMedia.id)).where(
            AuctionItemMedia.auction_item_id == auction_item_id,
            AuctionItemMedia.media_type == media_type,
        )
        result = await self.db.execute(stmt)
        count = result.scalar_one()

        # Check limits
        if media_type == "image" and count >= self.MAX_IMAGES_PER_ITEM:
            return False, f"Maximum {self.MAX_IMAGES_PER_ITEM} images per auction item"

        if media_type == "video" and count >= self.MAX_VIDEOS_PER_ITEM:
            return False, f"Maximum {self.MAX_VIDEOS_PER_ITEM} videos per auction item"

        return True, None

    def _generate_blob_name(
        self, auction_item_id: uuid.UUID, file_name: str, media_type: str
    ) -> str:
        """Generate a unique blob name for the media file.

        Args:
            auction_item_id: Auction item ID
            file_name: Original file name
            media_type: 'image' or 'video'

        Returns:
            Blob name in format: auction-items/{item_id}/{media_type}/{timestamp}_{hash}_{filename}
        """
        # Generate timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Generate hash for uniqueness
        hash_input = f"{auction_item_id}{timestamp}{file_name}".encode()
        file_hash = hashlib.sha256(hash_input).hexdigest()[:8]

        # Sanitize filename
        safe_name = "".join(c for c in file_name if c.isalnum() or c in "._-")

        # Construct blob name
        blob_name = (
            f"auction-items/{auction_item_id}/{media_type}/{timestamp}_{file_hash}_{safe_name}"
        )
        return blob_name

    def _generate_thumbnail_blob_name(self, original_blob_name: str, size: tuple[int, int]) -> str:
        """Generate blob name for thumbnail.

        Args:
            original_blob_name: Original image blob name
            size: Thumbnail size (width, height)

        Returns:
            Thumbnail blob name with size suffix
        """
        # Split extension
        name_parts = original_blob_name.rsplit(".", 1)
        base_name = name_parts[0]
        ext = name_parts[1] if len(name_parts) > 1 else "jpg"

        # Add size suffix
        return f"{base_name}_thumb_{size[0]}x{size[1]}.{ext}"

    async def _generate_thumbnails(
        self, file_content: bytes, original_blob_name: str
    ) -> dict[str, str]:
        """Generate thumbnails for an image.

        Args:
            file_content: Original image content as bytes
            original_blob_name: Original blob name

        Returns:
            Dict with thumbnail URLs: {'small': url, 'large': url}

        Raises:
            ValueError: If thumbnail generation fails
        """
        if not self.blob_service_client:
            raise ValueError("Azure Blob Storage not configured for thumbnail generation")

        try:
            # Open original image
            image = Image.open(BytesIO(file_content))

            # Convert RGBA to RGB if needed (for JPEG compatibility)
            if image.mode == "RGBA":
                background = Image.new("RGB", image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])  # Use alpha channel as mask
                image = background

            thumbnails = {}

            # Generate small thumbnail (200x200)
            small_thumb = image.copy()
            small_thumb.thumbnail(self.THUMBNAIL_SMALL, Image.Resampling.LANCZOS)
            small_blob_name = self._generate_thumbnail_blob_name(
                original_blob_name, self.THUMBNAIL_SMALL
            )

            # Upload small thumbnail
            small_buffer = BytesIO()
            small_thumb.save(small_buffer, format="JPEG", quality=85)
            small_buffer.seek(0)

            small_blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, blob=small_blob_name
            )
            small_blob_client.upload_blob(
                small_buffer.read(),
                blob_type="BlockBlob",
                content_settings=ContentSettings(content_type="image/jpeg"),
                overwrite=True,
            )
            thumbnails["small"] = str(small_blob_client.url)

            # Generate large thumbnail (800x600)
            large_thumb = image.copy()
            large_thumb.thumbnail(self.THUMBNAIL_LARGE, Image.Resampling.LANCZOS)
            large_blob_name = self._generate_thumbnail_blob_name(
                original_blob_name, self.THUMBNAIL_LARGE
            )

            # Upload large thumbnail
            large_buffer = BytesIO()
            large_thumb.save(large_buffer, format="JPEG", quality=90)
            large_buffer.seek(0)

            large_blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, blob=large_blob_name
            )
            large_blob_client.upload_blob(
                large_buffer.read(),
                blob_type="BlockBlob",
                content_settings=ContentSettings(content_type="image/jpeg"),
                overwrite=True,
            )
            thumbnails["large"] = str(large_blob_client.url)

            return thumbnails

        except Exception as e:
            raise ValueError(f"Failed to generate thumbnails: {str(e)}")

    def _get_account_key(self) -> str:
        """Extract account key from connection string.

        Returns:
            Account key

        Raises:
            ValueError: If account key not found
        """
        if not self.settings.azure_storage_connection_string:
            raise ValueError("Azure Storage connection string not configured")

        # Parse connection string
        conn_parts = dict(
            part.split("=", 1)
            for part in self.settings.azure_storage_connection_string.split(";")
            if "=" in part
        )

        account_key = conn_parts.get("AccountKey")
        if not account_key:
            raise ValueError("AccountKey not found in connection string")

        return account_key

    async def generate_upload_url(
        self,
        auction_item_id: uuid.UUID,
        file_name: str,
        content_type: str,
        file_size: int,
        media_type: str,
    ) -> dict[str, Any]:
        """Generate SAS URL for direct client upload to Azure Blob Storage.

        Args:
            auction_item_id: Auction item ID
            file_name: Original file name
            content_type: MIME type
            file_size: File size in bytes
            media_type: 'image' or 'video'

        Returns:
            Dict with upload_url, media_url, blob_name, and expires_in

        Raises:
            ValueError: If validation fails or Azure not configured
        """
        # Validate file type
        is_valid, error = self._validate_file_type(content_type, file_name, media_type)
        if not is_valid:
            raise ValueError(error)

        # Validate file size
        is_valid, error = self._validate_file_size(file_size, media_type)
        if not is_valid:
            raise ValueError(error)

        # Validate media count
        is_valid, error = await self._validate_media_count(auction_item_id, media_type)
        if not is_valid:
            raise ValueError(error)

        # Check Azure configuration
        if not self.blob_service_client or not self.settings.azure_storage_account_name:
            raise ValueError(
                "Azure Blob Storage not configured. "
                "Set AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_ACCOUNT_NAME."
            )

        # Generate blob name
        blob_name = self._generate_blob_name(auction_item_id, file_name, media_type)

        # Get blob client
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )

        # Generate SAS token with write permissions
        sas_token = generate_blob_sas(
            account_name=self.settings.azure_storage_account_name,
            container_name=self.container_name,
            blob_name=blob_name,
            account_key=self._get_account_key(),
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.utcnow() + timedelta(hours=self.SAS_EXPIRY_HOURS),
        )

        # Construct SAS URL
        sas_url = f"{blob_client.url}?{sas_token}"

        # Final public URL (without SAS)
        public_url = blob_client.url

        # Calculate expiry in seconds
        expires_in = int(self.SAS_EXPIRY_HOURS * 3600)

        return {
            "upload_url": sas_url,
            "media_url": public_url,
            "blob_name": blob_name,
            "expires_in": expires_in,
        }

    async def confirm_media_upload(
        self,
        auction_item_id: uuid.UUID,
        blob_name: str,
        file_name: str,
        file_size: int,
        content_type: str,
        media_type: str,
        video_url: str | None = None,
    ) -> AuctionItemMedia:
        """Confirm media upload and save metadata to database.

        For images, this will download the uploaded file and generate thumbnails.

        Args:
            auction_item_id: Auction item ID
            blob_name: Blob name in Azure Storage
            file_name: Original file name
            file_size: File size in bytes
            content_type: MIME type
            media_type: 'image' or 'video'
            video_url: Optional YouTube/Vimeo URL for video embeds

        Returns:
            Created AuctionItemMedia record

        Raises:
            ValueError: If file not found or thumbnail generation fails
        """
        if not self.blob_service_client:
            raise ValueError("Azure Blob Storage not configured")

        # Get the blob client
        blob_client = self.blob_service_client.get_blob_client(
            container=self.container_name, blob=blob_name
        )

        # Verify the blob exists
        if not blob_client.exists():
            raise ValueError(f"Blob not found: {blob_name}")

        # Get file path (public URL)
        file_path = str(blob_client.url)

        # Get current display order (max + 1)
        from sqlalchemy import func, select

        stmt = select(func.coalesce(func.max(AuctionItemMedia.display_order), -1)).where(
            AuctionItemMedia.auction_item_id == auction_item_id
        )
        result = await self.db.execute(stmt)
        max_order = result.scalar_one()
        display_order = max_order + 1

        # Initialize thumbnail path
        thumbnail_path = None

        # Generate thumbnails for images
        if media_type == "image":
            try:
                # Download the uploaded file
                blob_data = blob_client.download_blob().readall()

                # Validate image dimensions
                is_valid, error, _ = self._validate_image_dimensions(blob_data)
                if not is_valid:
                    # Delete the uploaded blob since validation failed
                    blob_client.delete_blob()
                    raise ValueError(error)

                # Generate thumbnails
                thumbnails = await self._generate_thumbnails(blob_data, blob_name)

                # Store small thumbnail URL (used for cards/lists)
                thumbnail_path = thumbnails.get("small")

            except Exception as e:
                # Clean up the uploaded blob if thumbnail generation fails
                try:
                    blob_client.delete_blob()
                except Exception:
                    pass
                raise ValueError(f"Failed to process image: {str(e)}")

        # Create media record
        media = AuctionItemMedia(
            auction_item_id=auction_item_id,
            media_type=media_type,
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            mime_type=content_type,
            display_order=display_order,
            thumbnail_path=thumbnail_path,
            video_url=video_url,
        )

        self.db.add(media)
        await self.db.commit()
        await self.db.refresh(media)

        return media

    async def reorder_media(
        self, auction_item_id: uuid.UUID, media_order: list[uuid.UUID]
    ) -> list[AuctionItemMedia]:
        """Reorder media items for drag-and-drop functionality.

        Args:
            auction_item_id: Auction item ID
            media_order: List of media IDs in desired order

        Returns:
            Updated list of media items in new order

        Raises:
            ValueError: If media IDs don't belong to the auction item
        """
        from sqlalchemy import select

        # Fetch all media for this auction item
        stmt = select(AuctionItemMedia).where(AuctionItemMedia.auction_item_id == auction_item_id)
        result = await self.db.execute(stmt)
        media_items = result.scalars().all()

        # Verify all media IDs belong to this item
        media_ids = {m.id for m in media_items}
        if set(media_order) != media_ids:
            raise ValueError("Invalid media IDs in order list")

        # Update display_order
        media_by_id = {m.id: m for m in media_items}
        for index, media_id in enumerate(media_order):
            media_by_id[media_id].display_order = index

        await self.db.commit()

        # Refresh all media items to get updated_at timestamps
        for media_id in media_order:
            await self.db.refresh(media_by_id[media_id])

        # Return in new order
        return [media_by_id[media_id] for media_id in media_order]

    async def delete_media(self, auction_item_id: uuid.UUID, media_id: uuid.UUID) -> bool:
        """Delete media item and associated files from Azure Blob Storage.

        Args:
            auction_item_id: Auction item ID
            media_id: Media ID to delete

        Returns:
            True if deleted successfully

        Raises:
            ValueError: If media not found or doesn't belong to auction item
        """
        from sqlalchemy import select

        # Fetch media
        stmt = select(AuctionItemMedia).where(
            AuctionItemMedia.id == media_id,
            AuctionItemMedia.auction_item_id == auction_item_id,
        )
        result = await self.db.execute(stmt)
        media = result.scalar_one_or_none()

        if not media:
            raise ValueError("Media not found or doesn't belong to this auction item")

        # Delete from Azure Blob Storage
        if self.blob_service_client and media.file_path:
            try:
                # Extract blob name from URL
                blob_name = media.file_path.split(f"/{self.container_name}/")[-1]

                # Delete main file
                blob_client = self.blob_service_client.get_blob_client(
                    container=self.container_name, blob=blob_name
                )
                blob_client.delete_blob()

                # Delete thumbnails if image
                if media.media_type == "image":
                    # Delete small thumbnail
                    small_thumb_name = self._generate_thumbnail_blob_name(
                        blob_name, self.THUMBNAIL_SMALL
                    )
                    try:
                        small_blob = self.blob_service_client.get_blob_client(
                            container=self.container_name, blob=small_thumb_name
                        )
                        small_blob.delete_blob()
                    except Exception:
                        pass  # Thumbnail might not exist

                    # Delete large thumbnail
                    large_thumb_name = self._generate_thumbnail_blob_name(
                        blob_name, self.THUMBNAIL_LARGE
                    )
                    try:
                        large_blob = self.blob_service_client.get_blob_client(
                            container=self.container_name, blob=large_thumb_name
                        )
                        large_blob.delete_blob()
                    except Exception:
                        pass  # Thumbnail might not exist

            except Exception:
                pass  # Continue with DB deletion even if blob deletion fails

        # Delete from database
        await self.db.delete(media)
        await self.db.commit()

        return True
