"""Integration tests for sponsor management workflows."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = [pytest.mark.asyncio, pytest.mark.requires_azure_storage]


class TestSponsorIntegration:
    """Test complete sponsor management workflows."""

    async def test_complete_sponsor_lifecycle(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test full workflow: create sponsor → get upload URL → upload logo → confirm → verify thumbnail."""

        # Step 1: Create sponsor with logo metadata
        create_payload = {
            "name": "Integration Test Sponsor Inc",
            "logo_size": "large",
            "logo_file_name": "sponsor-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 1024 * 500,  # 500KB
            "website_url": "https://example.com",
            "sponsor_level": "Gold",
            "contact_name": "John Doe",
            "contact_email": "john@example.com",
        }

        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        assert create_response.status_code == 201
        sponsor_data = create_response.json()
        sponsor_id = sponsor_data["sponsor"]["id"]

        # Verify initial sponsor data
        assert sponsor_data["sponsor"]["name"] == "Integration Test Sponsor Inc"
        assert sponsor_data["sponsor"]["logo_size"] == "large"
        assert sponsor_data["sponsor"]["sponsor_level"] == "Gold"
        assert sponsor_data["sponsor"]["display_order"] == 0
        assert "upload_url" in sponsor_data
        assert "expires_at" in sponsor_data

        # Verify upload URL structure
        upload_url = sponsor_data["upload_url"]
        assert upload_url.startswith("https://")
        assert "blob.core.windows.net" in upload_url
        assert "sponsors/" in upload_url
        assert sponsor_id in upload_url

        # Step 2: Mock logo upload to Azure (simulated)
        # In real scenario, client would PUT file to upload_url
        # Here we just verify the URL was generated correctly

        # Step 3: Confirm upload (this generates thumbnail)
        with (
            patch(
                "app.services.sponsor_logo_service.SponsorLogoService._get_blob_client"
            ) as mock_blob_client,
            patch("app.services.media_service.MediaService.generate_read_sas_url") as mock_sas_url,
        ):
            # Mock blob client for logo download and thumbnail upload
            mock_blob_service = MagicMock()
            mock_blob = MagicMock()

            # Mock logo download - create a minimal valid PNG (1x1 pixel)
            valid_png = (
                b"\x89PNG\r\n\x1a\n"  # PNG signature
                b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                b"\x08\x02\x00\x00\x00\x90wS\xde"  # IHDR chunk
                b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x00\x00\x00\x00"  # IDAT
                b"\x00\x00\x00\x00IEND\xaeB`\x82"  # IEND chunk
            )

            # Mock download_blob().readall() pattern
            mock_download = MagicMock()
            mock_download.readall.return_value = valid_png
            mock_blob.download_blob.return_value = mock_download

            # Mock thumbnail upload
            mock_thumbnail_blob = MagicMock()
            mock_thumbnail_blob.upload_blob = AsyncMock()

            mock_blob_service.get_blob_client.side_effect = lambda container, blob: (
                mock_thumbnail_blob if "thumb_" in blob else mock_blob
            )
            mock_blob_client.return_value = mock_blob_service

            # Mock SAS URL generation for read URLs
            def mock_generate_sas(blob_name, expiry_hours=24):
                return (
                    f"https://testaccount.blob.core.windows.net/event-media/{blob_name}?sas_token"
                )

            mock_sas_url.side_effect = mock_generate_sas

            # Get blob name from upload URL
            # URL format: https://account.blob.core.windows.net/container/blob_name?sas_token
            blob_name = upload_url.split("?")[0].split("/")[-1]  # Get last part before query string

            confirm_response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}/logo/confirm",
                json={"blob_name": blob_name},
            )
            assert confirm_response.status_code == 200
            confirmed_sponsor = confirm_response.json()

            # Verify logo URLs are set
            assert confirmed_sponsor["logo_url"] is not None
            assert confirmed_sponsor["thumbnail_url"] is not None
            assert "blob.core.windows.net" in confirmed_sponsor["logo_url"]
            assert "blob.core.windows.net" in confirmed_sponsor["thumbnail_url"]
            assert "thumb_" in confirmed_sponsor["thumbnail_url"]

        # Step 4: Fetch sponsors list and verify
        list_response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")
        assert list_response.status_code == 200
        sponsors_list = list_response.json()

        assert len(sponsors_list) == 1
        assert sponsors_list[0]["id"] == sponsor_id
        assert sponsors_list[0]["name"] == "Integration Test Sponsor Inc"
        assert sponsors_list[0]["logo_url"] is not None
        assert sponsors_list[0]["thumbnail_url"] is not None

        # Step 5: Get single sponsor by ID
        get_response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}"
        )
        assert get_response.status_code == 200
        single_sponsor = get_response.json()

        assert single_sponsor["id"] == sponsor_id
        assert single_sponsor["name"] == "Integration Test Sponsor Inc"
        assert single_sponsor["logo_size"] == "large"
        assert single_sponsor["logo_url"] is not None
        assert single_sponsor["thumbnail_url"] is not None

    async def test_sponsor_duplicate_name_validation(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test that duplicate sponsor names are rejected."""

        # Create first sponsor
        create_payload = {
            "name": "Unique Sponsor Name",
            "logo_size": "medium",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 1024 * 100,
        }

        first_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        assert first_response.status_code == 201

        # Attempt to create duplicate
        duplicate_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        assert duplicate_response.status_code == 400
        error_data = duplicate_response.json()

        # Error format: {'detail': {'code': 400, 'message': "Sponsor name ... already exists..."}}
        error_detail = error_data.get("detail", {})
        if isinstance(error_detail, dict):
            error_message = error_detail.get("message", error_detail.get("detail", ""))
        else:
            error_message = str(error_detail)

        # Verify "already exists" is in the error message
        error_str = str(error_message).lower()
        assert "already exists" in error_str, (
            f"Expected 'already exists' in error, got: {error_message} (full response: {error_data})"
        )

    async def test_sponsor_file_size_validation(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test that oversized files are rejected."""

        # Create sponsor with file exceeding 5MB limit
        create_payload = {
            "name": "Big Logo Sponsor",
            "logo_size": "large",
            "logo_file_name": "huge-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 6 * 1024 * 1024,  # 6MB (exceeds 5MB limit)
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        # Pydantic validation returns 422 for schema validation errors
        assert response.status_code == 422
        error_data = response.json()
        # Check that error mentions file size limit
        error_str = str(error_data).lower()
        assert "file" in error_str or "size" in error_str or "5242880" in error_str

    async def test_sponsor_ordering_by_display_order(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test that sponsors are returned in display_order."""

        # Create 3 sponsors
        sponsors_created = []
        for i, name in enumerate(["Alpha Sponsor", "Beta Sponsor", "Gamma Sponsor"]):
            create_payload = {
                "name": name,
                "logo_size": "medium",
                "logo_file_name": f"logo{i}.png",
                "logo_file_type": "image/png",
                "logo_file_size": 1024 * 100,
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=create_payload,
            )
            assert response.status_code == 201
            sponsors_created.append(response.json()["sponsor"])

        # Fetch sponsors list
        list_response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")
        assert list_response.status_code == 200
        sponsors_list = list_response.json()

        # Verify order matches creation order (display_order = 0, 1, 2)
        assert len(sponsors_list) == 3
        assert sponsors_list[0]["name"] == "Alpha Sponsor"
        assert sponsors_list[0]["display_order"] == 0
        assert sponsors_list[1]["name"] == "Beta Sponsor"
        assert sponsors_list[1]["display_order"] == 1
        assert sponsors_list[2]["name"] == "Gamma Sponsor"
        assert sponsors_list[2]["display_order"] == 2
