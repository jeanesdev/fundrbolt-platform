"""Integration tests for registration import feature."""

import json
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.ticket_management import TicketPackage
from app.services.registration_import_service import RegistrationImportService


@pytest.fixture
async def import_service(db_session: AsyncSession):
    """Create a RegistrationImportService instance."""
    return RegistrationImportService(db_session)


@pytest.fixture
async def test_ticket_package(db_session: AsyncSession, test_event: Event, test_user):
    """Create a test ticket package."""
    package = TicketPackage(
        event_id=test_event.id,
        created_by=test_user.id,
        name="VIP Table",
        description="VIP table package",
        price=Decimal("500.00"),
        seats_per_package=8,
        quantity_limit=10,
        sold_count=0,
        display_order=0,
    )
    db_session.add(package)

    # Also create a General Admission package
    general = TicketPackage(
        event_id=test_event.id,
        created_by=test_user.id,
        name="General Admission",
        description="General admission ticket",
        price=Decimal("150.00"),
        seats_per_package=1,
        quantity_limit=100,
        sold_count=0,
        display_order=1,
    )
    db_session.add(general)

    await db_session.commit()
    await db_session.refresh(package)
    return package


@pytest.mark.asyncio
@pytest.mark.integration
class TestRegistrationImportEndToEnd:
    """Test complete registration import workflow."""

    async def test_preflight_to_commit_workflow_json(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
        test_user,
    ):
        """Test complete workflow from preflight to commit with JSON file."""
        # Step 1: Create valid JSON data
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 2,
                "total_amount": 500.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-001",
            },
            {
                "registrant_name": "Jane Smith",
                "registrant_email": "jane@example.com",
                "registration_date": "2026-02-02",
                "ticket_package": "General Admission",
                "quantity": 1,
                "total_amount": 150.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-002",
            },
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")
        filename = "registrations.json"

        # Step 2: Run preflight
        preflight_report = await import_service.preflight(test_event.id, json_bytes, filename)

        # Verify preflight results
        assert preflight_report.total_rows == 2
        assert preflight_report.valid_rows == 2
        assert preflight_report.error_rows == 0
        assert preflight_report.created_count == 2
        assert preflight_report.skipped_count == 0
        assert preflight_report.file_type == "json"

        # Step 3: Commit the import (Note: will not create records due to stub)
        commit_report = await import_service.commit(
            test_event.id, json_bytes, filename, test_user.id
        )

        # Verify commit results (validation should still pass)
        assert commit_report.total_rows == 2
        assert commit_report.error_rows == 0

    async def test_preflight_to_commit_workflow_csv(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
        test_user,
    ):
        """Test complete workflow with CSV file."""
        csv_content = """registrant_name,registrant_email,registration_date,ticket_package,quantity,total_amount,payment_status,external_registration_id
John Doe,john@example.com,2026-02-01,VIP Table,2,500.00,Paid,REG-001
Jane Smith,jane@example.com,2026-02-02,General Admission,1,150.00,Paid,REG-002"""

        csv_bytes = csv_content.encode("utf-8")
        filename = "registrations.csv"

        # Run preflight
        preflight_report = await import_service.preflight(test_event.id, csv_bytes, filename)

        assert preflight_report.total_rows == 2
        assert preflight_report.valid_rows == 2
        assert preflight_report.file_type == "csv"

    async def test_preflight_with_validation_errors(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test preflight catches validation errors."""
        registrations = [
            {
                # Missing registrant_name
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 2,
                "total_amount": 500.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-001",
            },
            {
                "registrant_name": "Jane Smith",
                "registrant_email": "jane@example.com",
                "registration_date": "2026-02-02",
                "ticket_package": "NonExistent Package",  # Invalid package
                "quantity": 1,
                "total_amount": 150.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-002",
            },
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        assert report.error_rows == 2
        assert report.valid_rows == 0
        assert report.created_count == 0

    async def test_preflight_with_duplicate_detection(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test preflight detects in-file duplicates."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 1,
                "total_amount": 250.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-DUP",
            },
            {
                "registrant_name": "Jane Smith",
                "registrant_email": "jane@example.com",
                "registration_date": "2026-02-02",
                "ticket_package": "VIP Table",
                "quantity": 1,
                "total_amount": 250.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-DUP",  # Duplicate
            },
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        # Second row should have error
        assert report.error_rows >= 1
        duplicate_row = next((r for r in report.rows if r.row_number == 2), None)
        assert duplicate_row is not None
        assert duplicate_row.status.value == "error"

    async def test_preflight_with_warnings_allows_import(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test preflight with warnings still allows import."""
        registrations = [
            {
                "event_id": "DIFFERENT-EVENT",  # Should generate warning
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 1,
                "total_amount": 250.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-001",
            }
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        # Should have warnings but no errors
        assert report.error_rows == 0
        assert report.warning_rows > 0
        assert report.created_count == 1  # Still valid for import

    async def test_large_file_within_limit(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test handling of large files within the 5,000 row limit."""
        # Create 100 valid registrations
        registrations = [
            {
                "registrant_name": f"Person {i}",
                "registrant_email": f"person{i}@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 1,
                "total_amount": 250.00,
                "payment_status": "Paid",
                "external_registration_id": f"REG-{i:05d}",
            }
            for i in range(100)
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        assert report.total_rows == 100
        assert report.valid_rows == 100
        assert report.error_rows == 0


@pytest.mark.asyncio
@pytest.mark.integration
class TestRegistrationImportWithMultiplePackages:
    """Test imports with multiple ticket packages."""

    async def test_import_with_multiple_package_types(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test importing registrations for different ticket packages."""
        registrations = [
            {
                "registrant_name": "VIP Guest",
                "registrant_email": "vip@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 4,
                "total_amount": 1000.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-VIP-001",
            },
            {
                "registrant_name": "General Guest",
                "registrant_email": "general@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "General Admission",
                "quantity": 1,
                "total_amount": 150.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-GEN-001",
            },
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        assert report.valid_rows == 2
        assert report.error_rows == 0


@pytest.mark.asyncio
@pytest.mark.integration
class TestRegistrationImportValidation:
    """Test validation edge cases in integration."""

    async def test_invalid_date_formats(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test various invalid date formats are caught."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "02/01/2026",  # Wrong format
                "ticket_package": "VIP Table",
                "quantity": 1,
                "total_amount": 250.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-001",
            }
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        assert report.error_rows == 1
        assert any("date" in issue.message.lower() for row in report.rows for issue in row.issues)

    async def test_invalid_numeric_values(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test invalid numeric values are caught."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": "invalid",  # Should be number
                "total_amount": 250.00,
                "payment_status": "Paid",
                "external_registration_id": "REG-001",
            }
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        assert report.error_rows == 1

    async def test_negative_amounts_rejected(
        self,
        import_service: RegistrationImportService,
        test_event: Event,
        test_ticket_package: TicketPackage,
    ):
        """Test negative amounts are rejected."""
        registrations = [
            {
                "registrant_name": "John Doe",
                "registrant_email": "john@example.com",
                "registration_date": "2026-02-01",
                "ticket_package": "VIP Table",
                "quantity": 1,
                "total_amount": -100.00,  # Negative
                "payment_status": "Paid",
                "external_registration_id": "REG-001",
            }
        ]
        json_bytes = json.dumps(registrations).encode("utf-8")

        report = await import_service.preflight(test_event.id, json_bytes, "registrations.json")

        assert report.error_rows == 1
        assert any("amount" in issue.message.lower() for row in report.rows for issue in row.issues)
