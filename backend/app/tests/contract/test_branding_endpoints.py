"""Contract tests for NPO Branding API endpoints.

Tests the branding management API endpoints against the OpenAPI contract.
These tests verify that the API adheres to the expected request/response formats.
"""

import uuid
from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestBrandingGetContract:
    """Contract tests for GET /api/v1/npos/{npo_id}/branding endpoint."""

    async def test_get_branding_success_returns_200(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test getting branding returns 200 with default colors."""
        # Act
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "npo_id" in data
        assert data["npo_id"] == str(test_npo.id)
        assert "primary_color" in data
        assert "secondary_color" in data
        assert "logo_url" in data
        assert "social_media_links" in data
        assert "custom_css_properties" in data
        assert "created_at" in data
        assert "updated_at" in data

    async def test_get_branding_unauthenticated_returns_401(
        self, async_client: AsyncClient, test_npo: Any
    ):
        """Test getting branding without authentication returns 401."""
        response = await async_client.get(f"/api/v1/npos/{test_npo.id}/branding")

        assert response.status_code == 401

    async def test_get_branding_nonexistent_npo_returns_404(
        self, authenticated_client: AsyncClient
    ):
        """Test getting branding for non-existent NPO returns 404."""
        fake_id = uuid.uuid4()
        response = await authenticated_client.get(f"/api/v1/npos/{fake_id}/branding")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    async def test_get_branding_no_permission_returns_403(
        self, authenticated_client_2: AsyncClient, test_npo: Any
    ):
        """Test getting branding without NPO access returns 403."""
        response = await authenticated_client_2.get(f"/api/v1/npos/{test_npo.id}/branding")

        assert response.status_code == 403

    async def test_get_branding_invalid_uuid_returns_422(self, authenticated_client: AsyncClient):
        """Test getting branding with invalid UUID returns 422."""
        response = await authenticated_client.get("/api/v1/npos/not-a-uuid/branding")

        assert response.status_code == 422


@pytest.mark.asyncio
class TestBrandingUpdateContract:
    """Contract tests for PUT /api/v1/npos/{npo_id}/branding endpoint."""

    async def test_update_branding_success_returns_200(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test updating branding returns 200 with updated data."""
        update_data = {
            "primary_color": "#FF5733",
            "secondary_color": "#33FF57",
            "social_media_links": {
                "facebook": "https://facebook.com/testnpo",
                "twitter": "https://twitter.com/testnpo",
            },
        }

        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert "branding" in data
        assert "message" in data
        branding = data["branding"]
        assert branding["primary_color"] == "#FF5733"
        assert branding["secondary_color"] == "#33FF57"
        assert branding["social_media_links"]["facebook"] == "https://facebook.com/testnpo"

    async def test_update_branding_unauthenticated_returns_401(
        self, async_client: AsyncClient, test_npo: Any
    ):
        """Test updating branding without authentication returns 401."""
        response = await async_client.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"primary_color": "#FF5733"},
        )

        assert response.status_code == 401

    async def test_update_branding_no_permission_returns_403(
        self, authenticated_client_2: AsyncClient, test_npo: Any
    ):
        """Test updating branding without NPO admin access returns 403."""
        response = await authenticated_client_2.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"primary_color": "#FF5733"},
        )

        assert response.status_code == 403

    async def test_update_branding_invalid_color_format_returns_422(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test updating with invalid color format returns 422."""
        invalid_colors = [
            "FF5733",  # Missing #
            "#FF573",  # Too short
            "#FF57333",  # Too long
            "#GGGGGG",  # Invalid hex characters
            "red",  # Named color
            "rgb(255, 87, 51)",  # RGB format
        ]

        for color in invalid_colors:
            response = await authenticated_client.put(
                f"/api/v1/npos/{test_npo.id}/branding",
                json={"primary_color": color},
            )

            assert response.status_code == 422, f"Color {color} should return 422"
            data = response.json()
            assert "detail" in data

    async def test_update_branding_invalid_social_media_url_returns_422(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test updating with invalid social media URL returns 422."""
        invalid_links = {
            "facebook": "not-a-url",  # Invalid URL
            "twitter": "http://example.com",  # Not a Twitter URL
        }

        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"social_media_links": invalid_links},
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_update_branding_partial_update_succeeds(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test partial branding update (only some fields) succeeds."""
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"primary_color": "#FF5733"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["branding"]["primary_color"] == "#FF5733"
        # Other fields should remain unchanged


@pytest.mark.asyncio
class TestLogoUploadContract:
    """Contract tests for POST /api/v1/npos/{npo_id}/logo/upload-url endpoint."""

    async def test_generate_logo_upload_url_success_returns_200(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test generating logo upload URL returns 200 with signed URL."""
        upload_request = {
            "file_name": "logo.png",
            "file_size": 102400,  # 100KB
            "content_type": "image/png",
        }

        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload_request
        )

        assert response.status_code == 200
        data = response.json()
        assert "upload_url" in data
        assert "logo_url" in data
        assert "expires_in" in data
        assert "message" in data
        assert data["expires_in"] == 900  # 15 minutes
        assert "https://" in data["upload_url"]  # Signed URL
        assert "https://" in data["logo_url"]  # Public URL

    async def test_generate_logo_upload_url_unauthenticated_returns_401(
        self, async_client: AsyncClient, test_npo: Any
    ):
        """Test generating upload URL without authentication returns 401."""
        response = await async_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url",
            json={
                "file_name": "logo.png",
                "file_size": 102400,
                "content_type": "image/png",
            },
        )

        assert response.status_code == 401

    async def test_generate_logo_upload_url_no_permission_returns_403(
        self, authenticated_client_2: AsyncClient, test_npo: Any
    ):
        """Test generating upload URL without NPO admin access returns 403."""
        response = await authenticated_client_2.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url",
            json={
                "file_name": "logo.png",
                "file_size": 102400,
                "content_type": "image/png",
            },
        )

        assert response.status_code == 403

    async def test_generate_logo_upload_url_invalid_file_type_returns_422(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test generating URL with invalid file type returns 422."""
        invalid_types = [
            ("document.pdf", "application/pdf"),
            ("script.js", "application/javascript"),
            ("video.mp4", "video/mp4"),
            ("audio.mp3", "audio/mpeg"),
        ]

        for file_name, content_type in invalid_types:
            response = await authenticated_client.post(
                f"/api/v1/npos/{test_npo.id}/logo/upload-url",
                json={
                    "file_name": file_name,
                    "file_size": 102400,
                    "content_type": content_type,
                },
            )

            assert response.status_code == 422, f"{content_type} should return 422"

    async def test_generate_logo_upload_url_file_too_large_returns_422(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test generating URL with file too large returns 422."""
        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url",
            json={
                "file_name": "huge_logo.png",
                "file_size": 10_000_000,  # 10MB - exceeds 5MB limit
                "content_type": "image/png",
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    async def test_generate_logo_upload_url_missing_fields_returns_422(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test generating URL with missing fields returns 422."""
        incomplete_requests = [
            {"file_size": 102400, "content_type": "image/png"},  # Missing file_name
            {"file_name": "logo.png", "content_type": "image/png"},  # Missing file_size
            {"file_name": "logo.png", "file_size": 102400},  # Missing content_type
        ]

        for request_data in incomplete_requests:
            response = await authenticated_client.post(
                f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=request_data
            )

            assert response.status_code == 422

    async def test_generate_logo_upload_url_allowed_image_types(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test all allowed image types succeed."""
        allowed_types = [
            ("logo.jpg", "image/jpeg"),
            ("logo.jpeg", "image/jpeg"),
            ("logo.png", "image/png"),
            ("logo.gif", "image/gif"),
            ("logo.webp", "image/webp"),
        ]

        for file_name, content_type in allowed_types:
            response = await authenticated_client.post(
                f"/api/v1/npos/{test_npo.id}/logo/upload-url",
                json={
                    "file_name": file_name,
                    "file_size": 102400,
                    "content_type": content_type,
                },
            )

            assert response.status_code == 200, f"{content_type} should succeed"
