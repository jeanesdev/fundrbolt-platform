"""Contract tests for ticket sales import API endpoints."""

from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket_management import TicketPurchase
from app.models.ticket_sales_import import TicketSalesImportBatch


@pytest.mark.asyncio
class TestTicketSalesImportPreflight:
    """Test POST /api/v1/admin/events/{event_id}/ticket-sales/import/preflight."""

    async def test_preflight_success_csv(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful preflight with CSV file."""
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,2,200.00,2026-02-01,EXT-001
{test_ticket_package.name},Jane Smith,jane@example.com,1,100.00,2026-02-02,EXT-002"""

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response contract
        assert "preflight_id" in data
        assert data["detected_format"] == "csv"
        assert data["total_rows"] == 2
        assert data["valid_rows"] == 2
        assert data["error_rows"] == 0
        assert data["warning_rows"] == 0
        assert isinstance(data["issues"], list)
        assert isinstance(data["warnings"], list)

    async def test_preflight_success_json(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
    ) -> None:
        """Test successful preflight with JSON file."""
        json_content = f"""[
            {{
                "ticket_type": "{test_ticket_package.name}",
                "purchaser_name": "John Doe",
                "purchaser_email": "john@example.com",
                "quantity": 1,
                "total_amount": 100.00,
                "purchase_date": "2026-02-01",
                "external_sale_id": "EXT-001"
            }}
        ]"""

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.json", json_content, "application/json")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["detected_format"] == "json"
        assert data["total_rows"] == 1
        assert data["valid_rows"] == 1

    async def test_preflight_with_errors(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
    ) -> None:
        """Test preflight returns errors for invalid data."""
        # Missing required field (purchaser_name)
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},,john@example.com,1,100.00,2026-02-01,EXT-001"""

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        assert len(data["issues"]) > 0
        assert data["issues"][0]["severity"] == "error"
        assert "row_number" in data["issues"][0]
        assert "message" in data["issues"][0]

    async def test_preflight_invalid_ticket_type(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test preflight catches invalid ticket type."""
        csv_content = """ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
NonExistentType,John Doe,john@example.com,1,100.00,2026-02-01,EXT-001"""

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        ticket_type_errors = [i for i in data["issues"] if i.get("field_name") == "ticket_type"]
        assert len(ticket_type_errors) > 0
        assert "not found" in ticket_type_errors[0]["message"]

    async def test_preflight_row_limit_exceeded(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
    ) -> None:
        """Test preflight rejects files over 5,000 rows."""
        # Create file with 5,001 rows (header + 5,001 data rows)
        header = "ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id\n"
        rows = "\n".join(
            [
                f"{test_ticket_package.name},Person{i},email{i}@example.com,1,100.00,2026-02-01,EXT-{i}"
                for i in range(5001)
            ]
        )
        csv_content = header + rows

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("large.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 400
        assert "5000" in response.json()["message"]

    async def test_preflight_duplicate_in_file(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
    ) -> None:
        """Test preflight catches duplicate external_sale_id in file."""
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-DUP
{test_ticket_package.name},Jane Smith,jane@example.com,1,100.00,2026-02-02,EXT-DUP"""

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["error_rows"] > 0
        dup_errors = [i for i in data["issues"] if "Duplicate" in i["message"]]
        assert len(dup_errors) > 0

    async def test_preflight_unauthorized(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test preflight requires authentication."""
        csv_content = "ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id"

        response = await client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 401

    async def test_preflight_event_not_found(
        self,
        npo_admin_client: AsyncClient,
    ) -> None:
        """Test preflight returns 404 for non-existent event."""
        from uuid import uuid4

        csv_content = "ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id"

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{uuid4()}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestTicketSalesImportCommit:
    """Test POST /api/v1/admin/events/{event_id}/ticket-sales/import."""

    async def test_commit_success(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test successful import commit."""
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,2,200.00,2026-02-01,EXT-001"""

        # Run preflight first
        preflight_response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )
        preflight_data = preflight_response.json()
        preflight_id = preflight_data["preflight_id"]

        # Commit import
        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": preflight_id, "confirm": True},
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response contract
        assert "batch_id" in data
        assert data["created_rows"] == 1
        assert data["skipped_rows"] == 0
        assert data["failed_rows"] == 0
        assert isinstance(data["warnings"], list)

        # Verify ticket purchase was created
        stmt = select(TicketPurchase).where(TicketPurchase.external_sale_id == "EXT-001")
        result = await db_session.execute(stmt)
        purchase = result.scalar_one()

        assert purchase.quantity == 2
        assert str(purchase.total_price) == "200.00"
        assert purchase.purchaser_name == "John Doe"

    async def test_commit_skips_duplicates(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test commit skips rows with existing external_sale_id."""
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001"""

        # First import
        preflight1 = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales1.csv", csv_content, "text/csv")},
        )
        await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": preflight1.json()["preflight_id"], "confirm": True},
            files={"file": ("sales1.csv", csv_content, "text/csv")},
        )

        # Second import with same external_sale_id
        preflight2 = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales2.csv", csv_content, "text/csv")},
        )

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": preflight2.json()["preflight_id"], "confirm": True},
            files={"file": ("sales2.csv", csv_content, "text/csv")},
        )

        data = response.json()
        assert data["created_rows"] == 0
        assert data["skipped_rows"] == 1
        assert len(data["warnings"]) > 0

    async def test_commit_requires_preflight(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test commit requires valid preflight_id."""
        from uuid import uuid4

        csv_content = "ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id"

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": str(uuid4()), "confirm": True},
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 400
        assert "not found" in response.json()["message"]

    async def test_commit_requires_confirmation(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
    ) -> None:
        """Test commit requires confirm=true."""
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001"""

        preflight = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": preflight.json()["preflight_id"], "confirm": False},
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 400
        assert "confirmed" in response.json()["message"]

    async def test_commit_checksum_validation(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
    ) -> None:
        """Test commit validates file hasn't changed since preflight."""
        csv_content1 = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001"""

        preflight = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content1, "text/csv")},
        )

        # Try to commit with different file
        csv_content2 = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},Jane Smith,jane@example.com,1,100.00,2026-02-02,EXT-002"""

        response = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": preflight.json()["preflight_id"], "confirm": True},
            files={"file": ("sales.csv", csv_content2, "text/csv")},
        )

        assert response.status_code == 400
        assert "changed" in response.json()["message"]

    async def test_commit_unauthorized(
        self,
        client: AsyncClient,
        test_event: Any,
    ) -> None:
        """Test commit requires authentication."""
        from uuid import uuid4

        csv_content = "ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id"

        response = await client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": str(uuid4()), "confirm": True},
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 401

    async def test_commit_updates_batch_status(
        self,
        npo_admin_client: AsyncClient,
        test_event: Any,
        test_ticket_package: Any,
        db_session: AsyncSession,
    ) -> None:
        """Test commit updates batch status to imported."""
        csv_content = f"""ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
{test_ticket_package.name},John Doe,john@example.com,1,100.00,2026-02-01,EXT-001"""

        preflight = await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import/preflight",
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )
        preflight_id = preflight.json()["preflight_id"]

        await npo_admin_client.post(
            f"/api/v1/admin/events/{test_event.id}/ticket-sales/import",
            params={"preflight_id": preflight_id, "confirm": True},
            files={"file": ("sales.csv", csv_content, "text/csv")},
        )

        # Verify batch status
        stmt = select(TicketSalesImportBatch).where(TicketSalesImportBatch.id == UUID(preflight_id))
        result = await db_session.execute(stmt)
        batch = result.scalar_one()

        assert batch.status.value == "imported"
