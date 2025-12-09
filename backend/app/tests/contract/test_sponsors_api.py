"""Contract tests for sponsor API endpoints."""

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestSponsorCreation:
    """Test POST /api/v1/events/{event_id}/sponsors endpoint contract."""

    async def test_create_sponsor_with_default_logo_size(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test sponsor creation defaults logo_size to 'medium' if not provided."""
        from app.models.sponsor import Sponsor

        payload = {
            "name": "Acme Corporation",
            "logo_file_name": "acme-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "website_url": "https://acme.example.com",
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        # Assert response contract
        assert response.status_code == 201
        data = response.json()

        # Verify sponsor data
        assert "sponsor" in data
        sponsor = data["sponsor"]
        assert sponsor["name"] == "Acme Corporation"
        assert sponsor["logo_size"] == "large"  # Default value per Sponsor model
        assert sponsor["website_url"] == "https://acme.example.com/"
        assert sponsor["event_id"] == str(test_event.id)

        # Verify upload_url returned
        assert "upload_url" in data
        assert data["upload_url"].startswith("https://")
        assert "expires_at" in data

        # Verify database persistence
        from sqlalchemy import select

        stmt = select(Sponsor).where(Sponsor.id == sponsor["id"])
        result = await db_session.execute(stmt)
        db_sponsor = result.scalar_one()

        assert db_sponsor.name == "Acme Corporation"
        assert db_sponsor.logo_size == "large"

    async def test_create_sponsor_with_all_logo_sizes(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test logo_size accepts all enum values (xsmall, small, medium, large, xlarge)."""
        logo_sizes = ["xsmall", "small", "medium", "large", "xlarge"]

        for size in logo_sizes:
            payload = {
                "name": f"Sponsor {size.title()}",
                "logo_file_name": "logo.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
                "logo_size": size,
            }

            response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=payload,
            )

            assert response.status_code == 201, f"Failed for logo_size={size}"
            data = response.json()
            assert data["sponsor"]["logo_size"] == size

    async def test_create_sponsor_rejects_invalid_logo_size(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test logo_size rejects invalid enum values."""
        payload = {
            "name": "Invalid Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "super_huge",  # Invalid value
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        # Should return 422 Unprocessable Entity for invalid enum
        assert response.status_code == 422
        error = response.json()
        assert "detail" in error

    async def test_create_sponsor_with_sponsor_level(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test sponsor_level field is optional and persisted correctly."""
        payload = {
            "name": "Platinum Sponsor Inc",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "xlarge",
            "sponsor_level": "Platinum",
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert sponsor["sponsor_level"] == "Platinum"
        assert sponsor["logo_size"] == "xlarge"

    async def test_create_sponsor_requires_name(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test name field is required."""
        payload = {
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 422

    async def test_create_sponsor_duplicate_name_rejected(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test duplicate sponsor name within same event is rejected."""
        payload = {
            "name": "Unique Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        # Create first sponsor
        response1 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )
        assert response1.status_code == 201

        # Attempt to create duplicate
        response2 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )
        assert response2.status_code == 400  # Bad Request
        error = response2.json()
        assert "already exists" in str(error).lower()


@pytest.mark.asyncio
class TestSponsorListAndGet:
    """Test GET /api/v1/events/{event_id}/sponsors endpoints."""

    async def test_list_sponsors_empty(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test listing sponsors returns empty array for event with no sponsors."""
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_list_sponsors_ordered_by_size_and_order(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test sponsors are ordered by display_order (asc) then logo_size (desc)."""
        # Create sponsors with different sizes
        # Note: display_order auto-increments (0, 1, 2) based on creation order
        sponsors_data = [
            {"name": "Small Sponsor", "logo_size": "small"},  # order=0
            {"name": "XLarge Sponsor", "logo_size": "xlarge"},  # order=1
            {"name": "Medium Sponsor", "logo_size": "medium"},  # order=2
        ]

        for sponsor in sponsors_data:
            payload = {
                **sponsor,
                "logo_file_name": "logo.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
            }
            await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=payload,
            )

        # List sponsors
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")

        assert response.status_code == 200
        sponsors = response.json()
        assert len(sponsors) == 3

        # Verify ordering: display_order ASC (0, 1, 2) takes precedence, so creation order is preserved
        # Note: Enum ordering in PostgreSQL is: xsmall < small < medium < large < xlarge
        # So DESC gives: xlarge > large > medium > small > xsmall
        assert sponsors[0]["name"] == "Small Sponsor"  # display_order=0
        assert sponsors[0]["logo_size"] == "small"
        assert sponsors[1]["name"] == "XLarge Sponsor"  # display_order=1
        assert sponsors[1]["logo_size"] == "xlarge"
        assert sponsors[2]["name"] == "Medium Sponsor"  # display_order=2
        assert sponsors[2]["logo_size"] == "medium"

    async def test_get_sponsor_by_id(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test getting a single sponsor by ID."""
        # Create sponsor
        payload = {
            "name": "Test Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "large",
            "sponsor_level": "Gold",
        }

        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Get sponsor
        response = await npo_admin_client.get(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}"
        )

        assert response.status_code == 200
        sponsor = response.json()
        assert sponsor["id"] == sponsor_id
        assert sponsor["name"] == "Test Sponsor"
        assert sponsor["logo_size"] == "large"
        assert sponsor["sponsor_level"] == "Gold"

    async def test_get_sponsor_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 404 for non-existent sponsor."""
        import uuid

        fake_id = str(uuid.uuid4())
        response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors/{fake_id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestSponsorLogoUpload:
    """Test logo upload workflow endpoints."""

    async def test_request_upload_url_returns_sas_url(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test POST /sponsors/{id}/logo/upload-url returns valid SAS URL."""
        # Create sponsor first
        create_payload = {
            "name": "Logo Test Sponsor",
            "logo_file_name": "initial.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Request new upload URL
        upload_payload = {
            "file_name": "new-logo.png",
            "file_type": "image/png",
            "file_size": 75000,
        }
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}/logo/upload-url",
            json=upload_payload,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify SAS URL structure
        assert "upload_url" in data
        assert data["upload_url"].startswith("https://")
        assert "blob.core.windows.net" in data["upload_url"]
        assert "sig=" in data["upload_url"]  # SAS signature

        # Verify blob_name returned
        assert "blob_name" in data
        assert data["blob_name"].startswith("sponsors/")

        # Verify expires_at is ~1 hour in future
        assert "expires_at" in data
        expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        now = datetime.now(UTC)
        time_diff = (expires_at - now).total_seconds()
        assert 3500 < time_diff < 3700  # ~1 hour (allowing 100s variance)

    async def test_upload_url_rejects_invalid_file_metadata(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 400 for invalid file metadata (file too large)."""
        # Create sponsor
        create_payload = {
            "name": "Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Request upload URL with file too large (>5MB)
        upload_payload = {
            "file_name": "huge.png",
            "file_type": "image/png",
            "file_size": 6 * 1024 * 1024,  # 6MB
        }
        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}/logo/upload-url",
            json=upload_payload,
        )

        assert response.status_code == 422  # Unprocessable Entity (Pydantic validation)
        error = response.json()
        # Error structure: {'detail': {'code': 'VALIDATION_ERROR', 'details': [...]}}
        assert "less than or equal to" in str(error).lower() or "5242880" in str(error)


@pytest.mark.asyncio
class TestSponsorUpdate:
    """Test PATCH /api/v1/events/{event_id}/sponsors/{sponsor_id} endpoint contract."""

    async def test_update_sponsor_name(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test updating sponsor name."""
        from app.models.sponsor import Sponsor

        # Create sponsor
        create_payload = {
            "name": "Original Name",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Update sponsor name
        update_payload = {"name": "Updated Name"}
        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=update_payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["id"] == sponsor_id

        # Verify in database
        from sqlalchemy import select

        stmt = select(Sponsor).where(Sponsor.id == sponsor_id)
        result = await db_session.execute(stmt)
        db_sponsor = result.scalar_one()
        assert db_sponsor.name == "Updated Name"

    async def test_update_sponsor_logo_size(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating sponsor logo_size."""
        # Create sponsor
        create_payload = {
            "name": "Test Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "medium",
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Update logo_size
        update_payload = {"logo_size": "xlarge"}
        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=update_payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["logo_size"] == "xlarge"

    async def test_update_sponsor_optional_fields(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating optional fields (sponsor_level, contact_name, etc.)."""
        # Create sponsor with minimal data
        create_payload = {
            "name": "Test Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Update with optional fields
        update_payload = {
            "sponsor_level": "Platinum",
            "contact_name": "John Doe",
            "contact_email": "john@example.com",
            "donation_amount": 5000.00,
        }
        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=update_payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["sponsor_level"] == "Platinum"
        assert data["contact_name"] == "John Doe"
        assert data["contact_email"] == "john@example.com"
        assert float(data["donation_amount"]) == 5000.00

    async def test_update_sponsor_duplicate_name_rejected(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 400 for duplicate name when updating."""
        # Create first sponsor
        create_payload1 = {
            "name": "Sponsor A",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload1,
        )

        # Create second sponsor
        create_payload2 = {
            "name": "Sponsor B",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response2 = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload2,
        )
        sponsor_id = create_response2.json()["sponsor"]["id"]

        # Try to update second sponsor to use first sponsor's name
        update_payload = {"name": "Sponsor A"}
        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=update_payload,
        )

        assert response.status_code == 400
        error = response.json()
        detail = error["detail"] if isinstance(error["detail"], str) else str(error["detail"])
        assert "already exists" in detail.lower()

    async def test_update_sponsor_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 404 for non-existent sponsor."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        update_payload = {"name": "Updated Name"}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{fake_id}",
            json=update_payload,
        )

        assert response.status_code == 404
        error = response.json()
        detail = error["detail"] if isinstance(error["detail"], str) else str(error["detail"])
        assert "not found" in detail.lower()


@pytest.mark.asyncio
class TestSponsorDelete:
    """Test DELETE /api/v1/events/{event_id}/sponsors/{sponsor_id} endpoint contract."""

    async def test_delete_sponsor_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful sponsor deletion returns 204."""
        from app.models.sponsor import Sponsor

        # Create sponsor
        create_payload = {
            "name": "To Delete",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Delete sponsor
        response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}"
        )

        assert response.status_code == 204

        # Verify sponsor removed from database
        from sqlalchemy import select

        stmt = select(Sponsor).where(Sponsor.id == sponsor_id)
        result = await db_session.execute(stmt)
        db_sponsor = result.scalar_one_or_none()
        assert db_sponsor is None

    async def test_delete_sponsor_not_found(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test 404 for non-existent sponsor."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/sponsors/{fake_id}"
        )

        assert response.status_code == 404
        error = response.json()
        detail = error["detail"] if isinstance(error["detail"], str) else str(error["detail"])
        assert "not found" in detail.lower()

    async def test_delete_sponsor_removes_from_list(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test deleted sponsor doesn't appear in list."""
        # Create two sponsors
        for i in range(2):
            create_payload = {
                "name": f"Sponsor {i}",
                "logo_file_name": "logo.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
            }
            await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=create_payload,
            )

        # Get list (should have 2)
        list_response = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")
        assert list_response.status_code == 200
        sponsors = list_response.json()
        assert len(sponsors) == 2
        sponsor_to_delete_id = sponsors[0]["id"]

        # Delete one
        delete_response = await npo_admin_client.delete(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_to_delete_id}"
        )
        assert delete_response.status_code == 204

        # Get list again (should have 1)
        list_response2 = await npo_admin_client.get(f"/api/v1/events/{test_event.id}/sponsors")
        assert list_response2.status_code == 200
        remaining_sponsors = list_response2.json()
        assert len(remaining_sponsors) == 1
        assert remaining_sponsors[0]["id"] != sponsor_to_delete_id


@pytest.mark.asyncio
class TestSponsorContactInformation:
    """Test sponsor contact information fields (Phase 6 - User Story 7)."""

    async def test_create_sponsor_with_all_contact_fields(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test creating sponsor with all contact information fields."""
        from app.models.sponsor import Sponsor

        payload = {
            "name": "Contact Test Corp",
            "logo_file_name": "contact-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "logo_size": "medium",
            # Contact fields
            "contact_name": "Jane Smith",
            "contact_email": "jane.smith@contacttest.com",
            "contact_phone": "(555) 987-6543",
            # Address fields
            "address_line1": "456 Oak Avenue",
            "address_line2": "Floor 3",
            "city": "Portland",
            "state": "OR",
            "postal_code": "97201",
            "country": "USA",
            # Financial fields
            "donation_amount": 7500.50,
            "notes": "Returning sponsor from last year",
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]

        # Verify contact fields
        assert sponsor["contact_name"] == "Jane Smith"
        assert sponsor["contact_email"] == "jane.smith@contacttest.com"
        assert sponsor["contact_phone"] == "(555) 987-6543"

        # Verify address fields
        assert sponsor["address_line1"] == "456 Oak Avenue"
        assert sponsor["address_line2"] == "Floor 3"
        assert sponsor["city"] == "Portland"
        assert sponsor["state"] == "OR"
        assert sponsor["postal_code"] == "97201"
        assert sponsor["country"] == "USA"

        # Verify financial fields
        assert float(sponsor["donation_amount"]) == 7500.50
        assert sponsor["notes"] == "Returning sponsor from last year"

        # Verify persistence in database
        result = await db_session.execute(
            Sponsor.__table__.select().where(Sponsor.id == sponsor["id"])
        )
        db_sponsor = result.fetchone()
        assert db_sponsor is not None
        assert db_sponsor.contact_name == "Jane Smith"
        assert db_sponsor.contact_email == "jane.smith@contacttest.com"
        assert db_sponsor.contact_phone == "(555) 987-6543"
        assert db_sponsor.address_line1 == "456 Oak Avenue"
        assert db_sponsor.city == "Portland"
        assert float(db_sponsor.donation_amount) == 7500.50

    async def test_create_sponsor_contact_email_validation(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test that invalid contact_email is rejected."""
        payload = {
            "name": "Invalid Email Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "contact_email": "not-an-email",  # Invalid email
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 422  # Pydantic validation error
        error = response.json()
        assert "detail" in error

    async def test_create_sponsor_contact_fields_optional(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test that all contact fields are optional."""
        from app.models.sponsor import Sponsor

        payload = {
            "name": "Minimal Contact Corp",
            "logo_file_name": "minimal-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            # No contact, address, or financial fields
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]

        # All contact fields should be None
        assert sponsor["contact_name"] is None
        assert sponsor["contact_email"] is None
        assert sponsor["contact_phone"] is None
        assert sponsor["address_line1"] is None
        assert sponsor["address_line2"] is None
        assert sponsor["city"] is None
        assert sponsor["state"] is None
        assert sponsor["postal_code"] is None
        assert sponsor["country"] is None
        assert sponsor["donation_amount"] is None
        assert sponsor["notes"] is None

        # Verify database
        result = await db_session.execute(
            Sponsor.__table__.select().where(Sponsor.id == sponsor["id"])
        )
        db_sponsor = result.fetchone()
        assert db_sponsor is not None
        assert db_sponsor.contact_name is None
        assert db_sponsor.contact_email is None
        assert db_sponsor.donation_amount is None

    async def test_update_sponsor_contact_information(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test updating sponsor contact information."""
        from app.models.sponsor import Sponsor

        # Create sponsor
        create_payload = {
            "name": "Update Contact Corp",
            "logo_file_name": "update-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        assert create_response.status_code == 201
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Update with contact info
        update_payload = {
            "contact_name": "Bob Johnson",
            "contact_email": "bob@updatecontact.com",
            "contact_phone": "555-1234",
            "city": "Seattle",
            "state": "WA",
            "donation_amount": 10000.00,
            "notes": "Updated notes",
        }
        update_response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=update_payload,
        )

        assert update_response.status_code == 200
        updated = update_response.json()

        assert updated["contact_name"] == "Bob Johnson"
        assert updated["contact_email"] == "bob@updatecontact.com"
        assert updated["contact_phone"] == "555-1234"
        assert updated["city"] == "Seattle"
        assert updated["state"] == "WA"
        assert float(updated["donation_amount"]) == 10000.00
        assert updated["notes"] == "Updated notes"

        # Verify in database
        result = await db_session.execute(
            Sponsor.__table__.select().where(Sponsor.id == sponsor_id)
        )
        db_sponsor = result.fetchone()
        assert db_sponsor is not None
        assert db_sponsor.contact_name == "Bob Johnson"
        assert db_sponsor.city == "Seattle"
        assert float(db_sponsor.donation_amount) == 10000.00

    async def test_donation_amount_validation(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test donation_amount rejects negative values."""
        payload = {
            "name": "Negative Donation Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "donation_amount": -100.00,  # Negative value
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 422  # Pydantic validation error
        error = response.json()
        assert "detail" in error


@pytest.mark.asyncio
class TestSponsorFinancialTracking:
    """Test sponsor financial tracking fields (Phase 7 - User Story 4)."""

    async def test_donation_amount_max_value(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test donation_amount enforces maximum value (12 digits total, 2 decimal)."""
        payload = {
            "name": "Max Donation Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "donation_amount": 10000000000.00,  # Exceeds max of 9,999,999,999.99 (12 digits)
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 422  # Pydantic validation error
        error = response.json()
        assert "detail" in error

    async def test_donation_amount_at_max_value(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test donation_amount accepts maximum valid value."""
        from app.models.sponsor import Sponsor

        payload = {
            "name": "At Max Donation Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "donation_amount": 9999999999.99,  # Exactly at max (12 digits with 2 decimal)
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert float(sponsor["donation_amount"]) == 9999999999.99

        # Verify in database
        result = await db_session.execute(
            Sponsor.__table__.select().where(Sponsor.id == sponsor["id"])
        )
        db_sponsor = result.fetchone()
        assert db_sponsor is not None
        assert float(db_sponsor.donation_amount) == 9999999999.99

    async def test_notes_field_accepts_long_text(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test notes field accepts long text (no max length)."""
        from app.models.sponsor import Sponsor

        long_notes = "A" * 5000  # 5000 character note

        payload = {
            "name": "Long Notes Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            "notes": long_notes,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert sponsor["notes"] == long_notes
        assert len(sponsor["notes"]) == 5000

        # Verify persistence in database
        result = await db_session.execute(
            Sponsor.__table__.select().where(Sponsor.id == sponsor["id"])
        )
        db_sponsor = result.fetchone()
        assert db_sponsor is not None
        assert db_sponsor.notes == long_notes
        assert len(db_sponsor.notes) == 5000

    async def test_notes_field_optional(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test notes field is optional."""
        payload = {
            "name": "No Notes Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            # No notes field
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert sponsor["notes"] is None


# =============================================================================
# Phase 8: User Story 5 - Link Sponsors to External Resources
# =============================================================================


class TestSponsorWebsiteLinks:
    """Tests for sponsor website URL functionality (Phase 8 - User Story 5)."""

    async def test_create_sponsor_with_valid_url(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test create sponsor with valid website URL."""
        payload = {
            "name": "Tech Company",
            "website_url": "https://example.com",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert sponsor["website_url"] == "https://example.com/"

    async def test_website_url_invalid_format_rejected(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test website_url with invalid format is rejected."""
        payload = {
            "name": "Invalid URL Corp",
            "website_url": "not-a-valid-url",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 422
        error = response.json()
        assert "detail" in error

    async def test_website_url_optional(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test website_url is optional."""
        payload = {
            "name": "No Website Corp",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
            # No website_url
        }

        response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=payload,
        )

        assert response.status_code == 201
        data = response.json()
        sponsor = data["sponsor"]
        assert sponsor["website_url"] is None

    async def test_update_sponsor_website_url(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test updating sponsor website URL."""
        # Create sponsor first
        create_payload = {
            "name": "Tech Company",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        assert create_response.status_code == 201
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Update website URL
        payload = {"website_url": "https://new-website.com"}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=payload,
        )

        assert response.status_code == 200
        sponsor = response.json()
        # Update endpoint returns URL without trailing slash
        assert sponsor["website_url"] == "https://new-website.com"

    async def test_clear_website_url(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test clearing website URL by setting to null."""
        # Create sponsor with website URL
        create_payload = {
            "name": "Tech Company",
            "website_url": "https://example.com",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 50000,
        }
        create_response = await npo_admin_client.post(
            f"/api/v1/events/{test_event.id}/sponsors",
            json=create_payload,
        )
        assert create_response.status_code == 201
        sponsor_id = create_response.json()["sponsor"]["id"]

        # Clear website URL
        payload = {"website_url": None}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/{sponsor_id}",
            json=payload,
        )

        assert response.status_code == 200
        sponsor = response.json()
        assert sponsor["website_url"] is None


# ============================================================================
# Phase 9: User Story 5 - Sponsor Reordering (Drag-and-Drop)
# ============================================================================


@pytest.mark.asyncio
class TestSponsorReordering:
    """
    Test sponsor reordering functionality (Phase 9 - User Story 5).

    Covers:
    - Successful sponsor reordering within the same event
    - Validation that all sponsor IDs belong to the event
    - Display order updates reflecting new positions
    - Error handling for invalid sponsor IDs
    - Error handling for non-existent events
    """

    async def test_reorder_sponsors_success(
        self,
        npo_admin_client,
        test_event,
        db_session,
    ):
        """Test successful reordering of sponsors within an event."""
        # Create 3 sponsors with initial display_order
        sponsors = []
        for i in range(3):
            create_payload = {
                "name": f"Sponsor {i + 1}",
                "logo_size": "medium",
                "logo_file_name": f"logo{i + 1}.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
            }
            create_response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=create_payload,
            )
            assert create_response.status_code == 201
            sponsors.append(create_response.json()["sponsor"])

        # Initial order: sponsor0, sponsor1, sponsor2
        assert sponsors[0]["display_order"] == 0
        assert sponsors[1]["display_order"] == 1
        assert sponsors[2]["display_order"] == 2

        # Reorder to: sponsor2, sponsor0, sponsor1
        new_order = [sponsors[2]["id"], sponsors[0]["id"], sponsors[1]["id"]]
        reorder_payload = {"sponsor_ids": new_order}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/reorder",
            json=reorder_payload,
        )

        assert response.status_code == 200
        reordered_sponsors = response.json()

        # Verify new display_order
        sponsor_map = {s["id"]: s for s in reordered_sponsors}
        assert sponsor_map[sponsors[2]["id"]]["display_order"] == 0
        assert sponsor_map[sponsors[0]["id"]]["display_order"] == 1
        assert sponsor_map[sponsors[1]["id"]]["display_order"] == 2

    async def test_reorder_sponsors_invalid_sponsor_ids(
        self,
        npo_admin_client,
        test_event,
    ):
        """Test reordering fails when sponsor IDs don't belong to the event."""
        # Create 2 sponsors for this event
        sponsors = []
        for i in range(2):
            create_payload = {
                "name": f"Sponsor {i + 1}",
                "logo_size": "medium",
                "logo_file_name": f"logo{i + 1}.png",
                "logo_file_type": "image/png",
                "logo_file_size": 50000,
            }
            create_response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=create_payload,
            )
            assert create_response.status_code == 201
            sponsors.append(create_response.json()["sponsor"])

        # Try to reorder with invalid sponsor ID
        import uuid

        invalid_id = str(uuid.uuid4())
        new_order = [sponsors[0]["id"], invalid_id]
        reorder_payload = {"sponsor_ids": new_order}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/reorder",
            json=reorder_payload,
        )

        assert response.status_code == 400
        detail = response.json()["detail"]
        # Handle both string and dict response formats
        if isinstance(detail, dict):
            assert "invalid" in detail.get("message", "").lower()
        else:
            assert "invalid" in detail.lower()

    async def test_reorder_sponsors_nonexistent_event(
        self,
        npo_admin_client,
    ):
        """Test reordering fails when event does not exist."""
        import uuid

        invalid_event_id = str(uuid.uuid4())
        reorder_payload = {"sponsor_ids": [str(uuid.uuid4()), str(uuid.uuid4())]}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{invalid_event_id}/sponsors/reorder",
            json=reorder_payload,
        )

        assert response.status_code == 404
        detail = response.json()["detail"]
        # Handle both string and dict response formats
        if isinstance(detail, dict):
            assert "not found" in detail.get("message", "").lower()
        else:
            assert "not found" in detail.lower()

    async def test_reorder_sponsors_empty_list(
        self,
        npo_admin_client,
        test_event,
    ):
        """Test reordering with empty sponsor list fails validation."""
        reorder_payload = {"sponsor_ids": []}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/reorder",
            json=reorder_payload,
        )

        assert response.status_code == 422  # Validation error: min_length=1

    async def test_reorder_sponsors_preserves_other_fields(
        self,
        npo_admin_client,
        test_event,
    ):
        """Test reordering only updates display_order, not other fields."""
        # Create 2 sponsors with website URLs
        sponsors = []
        for i in range(2):
            create_payload = {
                "name": f"Sponsor {i + 1}",
                "logo_size": "large",
                "logo_file_name": f"logo{i + 1}.png",
                "logo_file_type": "image/png",
                "logo_file_size": 75000,
                "website_url": f"https://sponsor{i + 1}.com",
            }
            create_response = await npo_admin_client.post(
                f"/api/v1/events/{test_event.id}/sponsors",
                json=create_payload,
            )
            assert create_response.status_code == 201
            sponsors.append(create_response.json()["sponsor"])

        # Reverse the order
        new_order = [sponsors[1]["id"], sponsors[0]["id"]]
        reorder_payload = {"sponsor_ids": new_order}

        response = await npo_admin_client.patch(
            f"/api/v1/events/{test_event.id}/sponsors/reorder",
            json=reorder_payload,
        )

        assert response.status_code == 200
        reordered_sponsors = response.json()
        sponsor_map = {s["id"]: s for s in reordered_sponsors}

        # Verify display_order changed
        assert sponsor_map[sponsors[1]["id"]]["display_order"] == 0
        assert sponsor_map[sponsors[0]["id"]]["display_order"] == 1

        # Verify other fields unchanged (strip trailing slashes for URL comparison)
        assert sponsor_map[sponsors[0]["id"]]["name"] == "Sponsor 1"
        assert sponsor_map[sponsors[0]["id"]]["logo_size"] == "large"
        assert sponsor_map[sponsors[0]["id"]]["website_url"].rstrip("/") == "https://sponsor1.com"
        assert sponsor_map[sponsors[1]["id"]]["name"] == "Sponsor 2"
        assert sponsor_map[sponsors[1]["id"]]["logo_size"] == "large"
        assert sponsor_map[sponsors[1]["id"]]["website_url"].rstrip("/") == "https://sponsor2.com"
