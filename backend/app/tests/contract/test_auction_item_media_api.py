"""Contract tests for auction item media API endpoints."""

import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = [pytest.mark.asyncio, pytest.mark.requires_azure_storage]


class TestMediaUploadURL:
    """Test POST /api/v1/events/{event_id}/auction-items/{item_id}/media/upload-url endpoint."""

    async def test_generate_upload_url_for_image(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test generating upload URL for an image."""
        # Create an auction item first
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        # Mock Azure Blob Storage
        with patch("app.services.auction_item_media_service.BlobServiceClient") as mock_blob_client:
            mock_blob = MagicMock()
            mock_blob.url = (
                f"https://test.blob.core.windows.net/container/test-{auction_item.id}.jpg"
            )
            mock_blob_client.from_connection_string.return_value.get_blob_client.return_value = (
                mock_blob
            )

            payload = {
                "file_name": "test-image.jpg",
                "content_type": "image/jpeg",
                "file_size": 1024 * 1024,  # 1MB
                "media_type": "image",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/upload-url",
                json=payload,
            )

            # Assert response contract
            assert response.status_code == 200
            data = response.json()

            # Verify response structure
            assert "upload_url" in data
            assert "media_url" in data
            assert "blob_name" in data
            assert "expires_in" in data

            # Verify URLs are strings
            assert isinstance(data["upload_url"], str)
            assert isinstance(data["media_url"], str)
            assert isinstance(data["blob_name"], str)

            # Verify expiry is 15 minutes (900 seconds)
            assert data["expires_in"] == 900

            # Verify blob name format
            assert "auction-items" in data["blob_name"]
            assert str(auction_item.id) in data["blob_name"]
            assert "image" in data["blob_name"]

    async def test_generate_upload_url_for_video(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test generating upload URL for a video."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        with patch("app.services.auction_item_media_service.BlobServiceClient") as mock_blob_client:
            mock_blob = MagicMock()
            mock_blob.url = (
                f"https://test.blob.core.windows.net/container/test-{auction_item.id}.mp4"
            )
            mock_blob_client.from_connection_string.return_value.get_blob_client.return_value = (
                mock_blob
            )

            payload = {
                "file_name": "test-video.mp4",
                "content_type": "video/mp4",
                "file_size": 50 * 1024 * 1024,  # 50MB
                "media_type": "video",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/upload-url",
                json=payload,
            )

            assert response.status_code == 200
            data = response.json()
            assert "video" in data["blob_name"]

    async def test_upload_url_validation_invalid_file_type(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test validation of invalid file type."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        with patch("app.services.auction_item_media_service.BlobServiceClient"):
            payload = {
                "file_name": "test.pdf",
                "content_type": "application/pdf",
                "file_size": 1024 * 1024,
                "media_type": "image",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/upload-url",
                json=payload,
            )

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/upload-url",
                json=payload,
            )

            assert response.status_code == 400
            response_data = response.json()
            # Handle nested error format: {'detail': {'code': 400, 'message': '...'}} or {'detail': '...'}
            detail = response_data.get("detail", "")
            if isinstance(detail, dict):
                error_message = detail.get("message", "")
            else:
                error_message = detail
            assert "Invalid image type" in error_message

    async def test_upload_url_validation_file_too_large(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test validation of file size exceeding limit."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        with patch("app.services.auction_item_media_service.BlobServiceClient"):
            payload = {
                "file_name": "huge-image.jpg",
                "content_type": "image/jpeg",
                "file_size": 20 * 1024 * 1024,  # 20MB (exceeds 10MB limit)
                "media_type": "image",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/upload-url",
                json=payload,
            )

            assert response.status_code == 400
            response_data = response.json()
            # Handle nested error format
            detail = response_data.get("detail", "")
            if isinstance(detail, dict):
                error_message = detail.get("message", "")
            else:
                error_message = detail
            assert "exceeds" in error_message

    async def test_upload_url_unauthorized(
        self,
        client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test that unauthenticated users cannot generate upload URLs."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        payload = {
            "file_name": "test-image.jpg",
            "content_type": "image/jpeg",
            "file_size": 1024 * 1024,
            "media_type": "image",
        }

        response = await client.post(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/upload-url",
            json=payload,
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestMediaConfirm:
    """Test POST /api/v1/events/{event_id}/auction-items/{item_id}/media/confirm endpoint."""

    async def test_confirm_image_upload_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test confirming image upload with thumbnail generation."""
        from io import BytesIO

        from PIL import Image

        from app.models.auction_item import AuctionItem

        # Create auction item
        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        # Create a test image
        img = Image.new("RGB", (800, 600), color="red")
        img_bytes = BytesIO()
        img.save(img_bytes, format="JPEG")
        img_bytes.seek(0)

        # Mock Azure Blob Storage
        with patch("app.services.auction_item_media_service.BlobServiceClient") as mock_blob_client:
            mock_blob = MagicMock()
            mock_blob.url = "https://test.blob.core.windows.net/container/test.jpg"
            mock_blob.exists.return_value = True
            mock_blob.download_blob.return_value.readall.return_value = img_bytes.getvalue()

            # Mock thumbnail blobs
            mock_small_thumb = MagicMock()
            mock_small_thumb.url = (
                "https://test.blob.core.windows.net/container/test_thumb_200x200.jpg"
            )
            mock_large_thumb = MagicMock()
            mock_large_thumb.url = (
                "https://test.blob.core.windows.net/container/test_thumb_800x600.jpg"
            )

            def get_blob_client(container, blob):
                if "thumb_200x200" in blob:
                    return mock_small_thumb
                elif "thumb_800x600" in blob:
                    return mock_large_thumb
                else:
                    return mock_blob

            mock_blob_service = mock_blob_client.from_connection_string.return_value
            mock_blob_service.get_blob_client.side_effect = get_blob_client

            payload = {
                "blob_name": "auction-items/test.jpg",
                "file_name": "test.jpg",
                "file_size": len(img_bytes.getvalue()),
                "content_type": "image/jpeg",
                "media_type": "image",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/confirm",
                json=payload,
            )

            # Assert response contract
            assert response.status_code == 201
            data = response.json()

            # Verify response structure
            assert "id" in data
            assert data["auction_item_id"] == str(auction_item.id)
            assert data["media_type"] == "image"
            assert data["file_name"] == "test.jpg"
            assert data["file_size"] == len(img_bytes.getvalue())
            assert data["mime_type"] == "image/jpeg"
            assert data["display_order"] == 0  # First media item
            assert "file_path" in data
            assert "thumbnail_path" in data
            assert "created_at" in data
            assert "updated_at" in data

            # Verify thumbnail was generated
            assert data["thumbnail_path"] is not None
            assert "thumb_200x200" in data["thumbnail_path"]

    async def test_confirm_video_upload_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test confirming video upload."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        with patch("app.services.auction_item_media_service.BlobServiceClient") as mock_blob_client:
            mock_blob = MagicMock()
            mock_blob.url = "https://test.blob.core.windows.net/container/test.mp4"
            mock_blob.exists.return_value = True
            mock_blob_client.from_connection_string.return_value.get_blob_client.return_value = (
                mock_blob
            )

            payload = {
                "blob_name": "auction-items/test.mp4",
                "file_name": "test.mp4",
                "file_size": 10 * 1024 * 1024,
                "content_type": "video/mp4",
                "media_type": "video",
                "video_url": "https://youtube.com/watch?v=abc123",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/confirm",
                json=payload,
            )

            assert response.status_code == 201
            data = response.json()

            assert data["media_type"] == "video"
            assert data["video_url"] == "https://youtube.com/watch?v=abc123"
            assert data["thumbnail_path"] is None  # Videos don't have thumbnails

    async def test_confirm_upload_blob_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test error when blob doesn't exist."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        with patch("app.services.auction_item_media_service.BlobServiceClient") as mock_blob_client:
            mock_blob = MagicMock()
            mock_blob.exists.return_value = False
            mock_blob_client.from_connection_string.return_value.get_blob_client.return_value = (
                mock_blob
            )

            payload = {
                "blob_name": "auction-items/nonexistent.jpg",
                "file_name": "test.jpg",
                "file_size": 1024 * 1024,
                "content_type": "image/jpeg",
                "media_type": "image",
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/confirm",
                json=payload,
            )

            assert response.status_code == 400
            response_data = response.json()
            # Handle nested error format
            detail = response_data.get("detail", "")
            if isinstance(detail, dict):
                error_message = detail.get("message", "")
            else:
                error_message = detail
            assert "not found" in error_message.lower()


@pytest.mark.asyncio
class TestMediaList:
    """Test GET /api/v1/events/{event_id}/auction-items/{item_id}/media endpoint."""

    async def test_list_media_empty(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test listing media when none exist."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media"
        )

        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_media_with_items(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test listing media items ordered by display_order."""
        from app.models.auction_item import AuctionItem, AuctionItemMedia

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        # Create media items
        media1 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img1.jpg",
            file_name="img1.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=1,
        )
        media2 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img2.jpg",
            file_name="img2.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=0,
        )
        db_session.add_all([media1, media2])
        await db_session.commit()

        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media"
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 2
        assert len(data["items"]) == 2

        # Verify ordering by display_order
        assert data["items"][0]["display_order"] == 0
        assert data["items"][0]["file_name"] == "img2.jpg"
        assert data["items"][1]["display_order"] == 1
        assert data["items"][1]["file_name"] == "img1.jpg"

    async def test_list_media_public_access_for_published_items(
        self,
        client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test that public users can view media for published items."""
        from app.models.auction_item import AuctionItem, AuctionItemMedia

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="published",  # Published item
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        media = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img1.jpg",
            file_name="img1.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=0,
        )
        db_session.add(media)
        await db_session.commit()

        # Unauthenticated request
        response = await client.get(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    async def test_list_media_draft_requires_auth(
        self,
        client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test that draft item media requires authentication."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",  # Draft item
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        # Unauthenticated request
        response = await client.get(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media"
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestMediaReorder:
    """Test PATCH /api/v1/events/{event_id}/auction-items/{item_id}/media/reorder endpoint."""

    async def test_reorder_media_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful media reordering."""
        from app.models.auction_item import AuctionItem, AuctionItemMedia

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        # Create media items
        media1 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img1.jpg",
            file_name="img1.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=0,
        )
        media2 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img2.jpg",
            file_name="img2.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=1,
        )
        media3 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img3.jpg",
            file_name="img3.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=2,
        )
        db_session.add_all([media1, media2, media3])
        await db_session.commit()
        await db_session.refresh(media1)
        await db_session.refresh(media2)
        await db_session.refresh(media3)

        # Reorder: move media3 to first position
        payload = {"media_order": [str(media3.id), str(media1.id), str(media2.id)]}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/reorder",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 3
        # Verify new order
        assert data["items"][0]["id"] == str(media3.id)
        assert data["items"][0]["display_order"] == 0
        assert data["items"][1]["id"] == str(media1.id)
        assert data["items"][1]["display_order"] == 1
        assert data["items"][2]["id"] == str(media2.id)
        assert data["items"][2]["display_order"] == 2

    async def test_reorder_media_validation_missing_ids(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test validation when media IDs are missing."""
        from app.models.auction_item import AuctionItem, AuctionItemMedia

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        media1 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img1.jpg",
            file_name="img1.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=0,
        )
        media2 = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img2.jpg",
            file_name="img2.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=1,
        )
        db_session.add_all([media1, media2])
        await db_session.commit()
        await db_session.refresh(media1)

        # Only include one media ID (should fail)
        payload = {"media_order": [str(media1.id)]}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/reorder",
            json=payload,
        )

        assert response.status_code == 400
        response_data = response.json()
        # Handle nested error format
        detail = response_data.get("detail", "")
        if isinstance(detail, dict):
            error_message = detail.get("message", "")
        else:
            error_message = detail
        assert "Invalid media IDs" in error_message


@pytest.mark.asyncio
class TestMediaDelete:
    """Test DELETE /api/v1/events/{event_id}/auction-items/{item_id}/media/{media_id} endpoint."""

    async def test_delete_media_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful media deletion."""
        from app.models.auction_item import AuctionItem, AuctionItemMedia

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        media = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img1.jpg",
            file_name="img1.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=0,
        )
        db_session.add(media)
        await db_session.commit()
        await db_session.refresh(media)

        with patch("app.services.auction_item_media_service.BlobServiceClient") as mock_blob_client:
            mock_blob = MagicMock()
            mock_blob_client.from_connection_string.return_value.get_blob_client.return_value = (
                mock_blob
            )

            response = await npo_admin_client.delete(
                f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/{media.id}"
            )

            assert response.status_code == 204

            # Verify deletion from database
            from sqlalchemy import select

            stmt = select(AuctionItemMedia).where(AuctionItemMedia.id == media.id)
            result = await db_session.execute(stmt)
            deleted_media = result.scalar_one_or_none()
            assert deleted_media is None

    async def test_delete_media_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test deleting non-existent media."""
        from app.models.auction_item import AuctionItem

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        fake_media_id = uuid.uuid4()

        response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/{fake_media_id}"
        )

        assert response.status_code == 404

    async def test_delete_media_unauthorized(
        self,
        client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test that unauthenticated users cannot delete media."""
        from app.models.auction_item import AuctionItem, AuctionItemMedia

        auction_item = AuctionItem(
            event_id=test_event.id,
            title="Test Item",
            description="Test Description",
            auction_type="silent",
            bid_number=100,
            starting_bid=100.00,
            bid_increment=10.00,
            quantity_available=1,
            status="draft",
            created_by=test_event.created_by,
        )
        db_session.add(auction_item)
        await db_session.commit()
        await db_session.refresh(auction_item)

        media = AuctionItemMedia(
            auction_item_id=auction_item.id,
            media_type="image",
            file_path="https://test.blob.core.windows.net/container/img1.jpg",
            file_name="img1.jpg",
            file_size=1024 * 1024,
            mime_type="image/jpeg",
            display_order=0,
        )
        db_session.add(media)
        await db_session.commit()
        await db_session.refresh(media)

        response = await client.delete(
            f"/api/v1/events/{test_event.id}/auction-items/{auction_item.id}/media/{media.id}"
        )

        assert response.status_code == 401
