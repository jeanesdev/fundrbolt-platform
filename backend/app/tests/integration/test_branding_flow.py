"""Integration tests for NPO Branding complete workflows.

Tests the end-to-end branding management workflows including logo upload,
color customization, and social media link management.
"""

from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestBrandingCompleteFlow:
    """Integration tests for complete branding workflow."""

    async def test_complete_branding_customization_workflow(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test complete workflow: get default → update colors → add logo → add social media."""
        # Step 1: Get default branding (created automatically with NPO)
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        assert response.status_code == 200
        branding = response.json()
        assert branding["npo_id"] == str(test_npo.id)
        assert branding["primary_color"] is None
        assert branding["logo_url"] is None

        # Step 2: Update colors
        color_update = {
            "primary_color": "#FF5733",
            "secondary_color": "#33FF57",
        }
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=color_update
        )
        assert response.status_code == 200
        branding = response.json()["branding"]
        assert branding["primary_color"] == "#FF5733"
        assert branding["secondary_color"] == "#33FF57"

        # Step 3: Generate logo upload URL
        upload_request = {
            "file_name": "logo.png",
            "file_size": 102400,
            "content_type": "image/png",
        }
        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload_request
        )
        assert response.status_code == 200
        upload_data = response.json()
        assert "upload_url" in upload_data
        assert "logo_url" in upload_data
        logo_url = upload_data["logo_url"]

        # Step 4: Update branding with logo URL (simulating successful upload)
        logo_update = {"logo_url": logo_url}
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=logo_update
        )
        assert response.status_code == 200
        branding = response.json()["branding"]
        assert branding["logo_url"] == logo_url

        # Step 5: Add social media links
        social_update = {
            "social_media_links": {
                "facebook": "https://facebook.com/testnpo",
                "twitter": "https://twitter.com/testnpo",
                "instagram": "https://instagram.com/testnpo",
                "linkedin": "https://linkedin.com/company/testnpo",
            }
        }
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=social_update
        )
        assert response.status_code == 200
        branding = response.json()["branding"]
        assert len(branding["social_media_links"]) == 4

        # Step 6: Verify final state
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        assert response.status_code == 200
        final_branding = response.json()
        assert final_branding["primary_color"] == "#FF5733"
        assert final_branding["secondary_color"] == "#33FF57"
        assert final_branding["logo_url"] == logo_url
        assert len(final_branding["social_media_links"]) == 4

    async def test_branding_updates_are_idempotent(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test updating same branding values multiple times is idempotent."""
        update_data = {
            "primary_color": "#FF5733",
            "secondary_color": "#33FF57",
        }

        # First update
        response1 = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=update_data
        )
        assert response1.status_code == 200
        branding_id_1 = response1.json()["branding"]["id"]

        # Second update with same data
        response2 = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=update_data
        )
        assert response2.status_code == 200
        branding_id_2 = response2.json()["branding"]["id"]

        # Should be same branding record
        assert branding_id_1 == branding_id_2

        # Verify data unchanged
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        branding = response.json()
        assert branding["primary_color"] == "#FF5733"
        assert branding["secondary_color"] == "#33FF57"

    async def test_partial_branding_updates_preserve_existing_data(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test partial updates don't clear unspecified fields."""
        # Set initial complete branding
        initial_data = {
            "primary_color": "#FF5733",
            "secondary_color": "#33FF57",
            "social_media_links": {
                "facebook": "https://facebook.com/testnpo",
                "twitter": "https://twitter.com/testnpo",
            },
        }
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=initial_data
        )
        assert response.status_code == 200

        # Partial update - only change primary color
        partial_update = {"primary_color": "#123456"}
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json=partial_update
        )
        assert response.status_code == 200

        # Verify other fields preserved
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        branding = response.json()
        assert branding["primary_color"] == "#123456"  # Updated
        assert branding["secondary_color"] == "#33FF57"  # Preserved
        assert (
            branding["social_media_links"]["facebook"] == "https://facebook.com/testnpo"
        )  # Preserved

    async def test_branding_deletion_when_npo_deleted(
        self, authenticated_superadmin_client: AsyncClient, test_npo: Any
    ):
        """Test branding is deleted when NPO is deleted (CASCADE)."""
        # Set up branding
        await authenticated_superadmin_client.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"primary_color": "#FF5733"},
        )

        # Verify branding exists
        response = await authenticated_superadmin_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        assert response.status_code == 200

        # Delete NPO (soft delete)
        response = await authenticated_superadmin_client.delete(f"/api/v1/npos/{test_npo.id}")
        assert response.status_code == 204

        # Branding should no longer be accessible
        response = await authenticated_superadmin_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        assert response.status_code in [404, 403]  # NPO not found or access denied


@pytest.mark.asyncio
class TestLogoUploadFlow:
    """Integration tests for logo upload workflow."""

    async def test_logo_upload_complete_flow(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test complete logo upload workflow."""
        # Step 1: Request upload URL
        upload_request = {
            "file_name": "company-logo.png",
            "file_size": 204800,  # 200KB
            "content_type": "image/png",
        }
        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload_request
        )
        assert response.status_code == 200
        upload_data = response.json()

        # Verify response structure
        assert "upload_url" in upload_data
        assert "logo_url" in upload_data
        assert upload_data["expires_in"] == 900
        assert "blob.core.windows.net" in upload_data["upload_url"]  # Azure Blob
        assert upload_data["logo_url"].startswith("https://")

        # Step 2: Update branding with logo URL
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"logo_url": upload_data["logo_url"]},
        )
        assert response.status_code == 200

        # Step 3: Verify logo is set
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        branding = response.json()
        assert branding["logo_url"] == upload_data["logo_url"]

    async def test_logo_replacement_workflow(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test replacing existing logo."""
        # Upload first logo
        upload1 = {
            "file_name": "old-logo.png",
            "file_size": 102400,
            "content_type": "image/png",
        }
        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload1
        )
        logo_url_1 = response.json()["logo_url"]
        await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json={"logo_url": logo_url_1}
        )

        # Upload replacement logo
        upload2 = {
            "file_name": "new-logo.png",
            "file_size": 153600,
            "content_type": "image/png",
        }
        response = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload2
        )
        logo_url_2 = response.json()["logo_url"]
        await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding", json={"logo_url": logo_url_2}
        )

        # Verify new logo is set
        response = await authenticated_client.get(f"/api/v1/npos/{test_npo.id}/branding")
        branding = response.json()
        assert branding["logo_url"] == logo_url_2
        assert branding["logo_url"] != logo_url_1

    async def test_logo_upload_url_different_per_file(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test each upload request generates unique URL."""
        upload_request = {
            "file_name": "logo.png",
            "file_size": 102400,
            "content_type": "image/png",
        }

        response1 = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload_request
        )
        url1 = response1.json()["upload_url"]

        response2 = await authenticated_client.post(
            f"/api/v1/npos/{test_npo.id}/logo/upload-url", json=upload_request
        )
        url2 = response2.json()["upload_url"]

        # URLs should be different (different SAS tokens)
        assert url1 != url2


@pytest.mark.asyncio
class TestBrandingPermissions:
    """Integration tests for branding permission checks."""

    async def test_npo_member_cannot_update_branding(
        self, authenticated_client: AsyncClient, authenticated_client_2: AsyncClient, test_npo: Any
    ):
        """Test NPO member without admin role cannot update branding."""
        # TODO: Add test_user_2 as regular member (not admin) to test_npo
        # For now, test_user_2 has no relationship to test_npo

        response = await authenticated_client_2.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"primary_color": "#FF5733"},
        )

        assert response.status_code == 403
        data = response.json()
        assert "detail" in data

    async def test_npo_admin_can_update_branding(
        self, authenticated_client: AsyncClient, test_npo: Any
    ):
        """Test NPO admin (creator) can update branding."""
        response = await authenticated_client.put(
            f"/api/v1/npos/{test_npo.id}/branding",
            json={"primary_color": "#FF5733"},
        )

        assert response.status_code == 200

    async def test_superadmin_can_view_any_npo_branding(
        self, authenticated_superadmin_client: AsyncClient, test_npo: Any
    ):
        """Test SuperAdmin can view any NPO's branding."""
        response = await authenticated_superadmin_client.get(f"/api/v1/npos/{test_npo.id}/branding")

        assert response.status_code == 200
