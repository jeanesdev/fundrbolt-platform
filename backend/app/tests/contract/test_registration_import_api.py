"""Contract tests for registration import API endpoints."""

import io
import json

import pytest
from httpx import AsyncClient
from openpyxl import Workbook

from app.models.event import Event


def _get_detail_message(payload: dict) -> str:
    detail = payload.get("detail", payload)
    if isinstance(detail, dict):
        return str(detail.get("message", detail))
    return str(detail)


@pytest.mark.asyncio
class TestRegistrationImportPreflight:
    """Test POST /api/v1/admin/events/{event_id}/registrations/import/preflight endpoint."""

    async def test_preflight_valid_json_file(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight with valid JSON file."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 2,
                "external_registration_id": "REG-001",
            },
            {
                "registrant_name": "Jane Smith",
                "registrant_email": "jane@example.com",
                "registration_date": "2026-02-02",
                "quantity": 1,
                "external_registration_id": "REG-002",
            },
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify report structure
        assert data["total_rows"] == 2
        assert data["valid_rows"] == 2
        assert data["error_rows"] == 0
        assert data["warning_rows"] == 0
        assert data["created_count"] == 2
        assert data["skipped_count"] == 0
        assert data["failed_count"] == 0
        assert data["file_type"] == "json"
        assert len(data["rows"]) == 2

        # Verify row details
        assert data["rows"][0]["status"] == "created"
        assert data["rows"][0]["row_number"] == 1
        assert data["rows"][0]["external_id"] == "REG-001"
        assert data["rows"][0]["registrant_name"] == "John Doe"

    async def test_preflight_valid_csv_file(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight with valid CSV file."""
        csv_content = """registrant_name,registrant_email,registration_date,quantity,external_registration_id
John Doe,john@example.com,2026-02-01,2,REG-001
Jane Smith,jane@example.com,2026-02-02,1,REG-002"""

        csv_bytes = csv_content.encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.csv", csv_bytes, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_rows"] == 2
        assert data["valid_rows"] == 2
        assert data["error_rows"] == 0
        assert data["file_type"] == "csv"

    async def test_preflight_valid_excel_file(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight with valid Excel file."""
        wb = Workbook()
        ws = wb.active
        ws.append(
            [
                "registrant_name",
                "registrant_email",
                "registration_date",
                "quantity",
                "external_registration_id",
            ]
        )
        ws.append(
            [
                "John Doe",
                "john@example.com",
                "2026-02-01",
                2,
                "REG-001",
            ]
        )

        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_bytes = excel_buffer.getvalue()

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={
                "file": (
                    "registrations.xlsx",
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_rows"] == 1
        assert data["valid_rows"] == 1
        assert data["file_type"] == "xlsx"

    async def test_preflight_missing_required_fields(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight fails with missing required fields."""
        registrations = [
            {
                "registrant_name": "",  # Missing
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 2,
                "external_registration_id": "REG-001",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        assert data["rows"][0]["status"] == "error"
        assert len(data["rows"][0]["issues"]) > 0
        assert any(issue["severity"] == "error" for issue in data["rows"][0]["issues"])

    async def test_preflight_duplicate_external_id(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight detects duplicate external IDs in file."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-DUP",
            },
            {
                "registrant_name": "Jane Smith",
                "registrant_email": "jane@example.com",
                "registration_date": "2026-02-02",
                "quantity": 1,
                "external_registration_id": "REG-DUP",  # Duplicate
            },
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        # Second row should have duplicate error
        second_row = next((r for r in data["rows"] if r["row_number"] == 2), None)
        assert second_row is not None
        assert second_row["status"] == "error"
        assert any("Duplicate" in issue["message"] for issue in second_row["issues"])

    async def test_preflight_nonexistent_ticket_purchase(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight fails with non-existent ticket purchase."""
        from uuid import uuid4

        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-001",
                "ticket_purchase_id": str(uuid4()),
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        assert data["rows"][0]["status"] == "error"
        assert any(
            "Ticket purchase not found" in issue["message"] for issue in data["rows"][0]["issues"]
        )

    async def test_preflight_invalid_file_type(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight rejects unsupported file types."""
        text_content = b"This is a text file"

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.txt", text_content, "text/plain")},
        )

        assert response.status_code == 400
        assert "Unsupported file type" in _get_detail_message(response.json())

    async def test_preflight_empty_file(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight rejects empty files."""
        json_content = json.dumps([]).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 400
        assert "contains no data" in _get_detail_message(response.json())

    async def test_preflight_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ):
        """Test preflight fails with non-existent event."""
        from uuid import uuid4

        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-001",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        fake_event_id = uuid4()
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{fake_event_id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 404
        assert "Event not found" in _get_detail_message(response.json())

    async def test_preflight_requires_authentication(
        self,
        client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight requires authentication."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-001",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 401

    async def test_preflight_with_optional_fields(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test preflight with optional fields included."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 2,
                "external_registration_id": "REG-001",
                "registrant_phone": "555-1234",
                "bidder_number": 100,
                "table_number": 5,
                "guest_count": 2,
                "notes": "Special request",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/preflight",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["valid_rows"] == 1
        assert data["error_rows"] == 0


@pytest.mark.asyncio
class TestRegistrationImportCommit:
    """Test POST /api/v1/admin/events/{event_id}/registrations/import/commit endpoint."""

    async def test_commit_requires_authentication(
        self,
        client: AsyncClient,
        test_event: Event,
    ):
        """Test commit requires authentication."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-001",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/commit",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 401

    async def test_commit_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ):
        """Test commit fails with non-existent event."""
        from uuid import uuid4

        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-001",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        fake_event_id = uuid4()
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{fake_event_id}/registrations/import/commit",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 404
        assert "Event not found" in _get_detail_message(response.json())

    async def test_commit_invalid_file_type(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test commit rejects unsupported file types."""
        text_content = b"This is a text file"

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/commit",
            files={"file": ("registrations.txt", text_content, "text/plain")},
        )

        assert response.status_code == 400
        assert "Unsupported file type" in _get_detail_message(response.json())

    async def test_commit_validates_before_creating(
        self,
        npo_admin_client: AsyncClient,
        test_event: Event,
    ):
        """Test commit validates data before attempting creation."""
        registrations = [
            {
                "registrant_name": "",  # Missing required field
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "quantity": 1,
                "external_registration_id": "REG-001",
            }
        ]
        json_content = json.dumps(registrations).encode("utf-8")

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/registrations/import/commit",
            files={"file": ("registrations.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        # Should not create any records due to validation errors
        assert data["created_count"] == 0
        assert data["failed_count"] == 1
        assert data["error_rows"] > 0
