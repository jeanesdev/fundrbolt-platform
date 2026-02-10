# Ticket Sales Import Tests

This directory contains comprehensive tests for the ticket sales import feature.

## Test Structure

### Unit Tests (`unit/test_ticket_sales_import_service.py`)

Tests for `TicketSalesImportService` business logic:

- **Format Detection**: CSV, JSON, Excel detection
- **File Parsing**: Valid and invalid file parsing
- **Row Validation**: Required fields, ticket type existence, quantity/amount validation, duplicates
- **Preflight Flow**: Success scenarios, batch record creation
- **Import Flow**: Purchase creation, sold count updates, duplicate skipping, checksum validation

### Contract Tests (`contract/test_ticket_sales_import_api.py`)

Tests for API endpoint contracts:

- **Preflight Endpoint** (`POST /api/v1/admin/events/{event_id}/ticket-sales/import/preflight`):
  - Success with CSV, JSON files
  - Error scenarios (missing fields, invalid ticket type, row limit, duplicates)
  - Authorization checks
  
- **Import Endpoint** (`POST /api/v1/admin/events/{event_id}/ticket-sales/import`):
  - Successful import with purchase creation
  - Duplicate skipping
  - Preflight requirement
  - Confirmation requirement
  - Checksum validation
  - Batch status updates

## Running Tests

### All Tests
```bash
cd backend
poetry run pytest app/tests/unit/test_ticket_sales_import_service.py -v
poetry run pytest app/tests/contract/test_ticket_sales_import_api.py -v
```

### Specific Test Class
```bash
poetry run pytest app/tests/unit/test_ticket_sales_import_service.py::TestTicketSalesImportService -v
```

### Single Test
```bash
poetry run pytest app/tests/unit/test_ticket_sales_import_service.py::TestTicketSalesImportService::test_preflight_success_no_errors -v
```

### With Coverage
```bash
poetry run pytest app/tests/unit/test_ticket_sales_import_service.py --cov=app.services.ticket_sales_import_service --cov-report=term-missing
```

## Test Fixtures

The tests use the following fixtures from `conftest.py`:

- `db_session`: Test database session
- `test_event`: Test event in DRAFT status
- `test_ticket_package`: Test ticket package (General Admission)
- `test_user`: Test user for authentication
- `npo_admin_client`: Authenticated client with NPO admin permissions
- `client`: Unauthenticated client for 401 tests

## Test Coverage

The test suite covers:

✅ **Parsing**: CSV, JSON, Excel file parsing
✅ **Validation**: All required fields, data types, business rules
✅ **Error Detection**: Missing fields, invalid types, duplicates
✅ **Preflight**: Success and failure scenarios
✅ **Import**: Purchase creation, sold count updates
✅ **Idempotency**: Duplicate external_sale_id handling
✅ **Security**: Checksum validation, authorization
✅ **API Contracts**: Request/response schemas
✅ **Database**: Batch and purchase persistence

## Test Data Examples

### Valid CSV
```csv
ticket_type,purchaser_name,purchaser_email,quantity,total_amount,purchase_date,external_sale_id
General Admission,John Doe,john@example.com,2,200.00,2026-02-01,EXT-001
```

### Valid JSON
```json
[
  {
    "ticket_type": "General Admission",
    "purchaser_name": "John Doe",
    "purchaser_email": "john@example.com",
    "quantity": 2,
    "total_amount": 200.00,
    "purchase_date": "2026-02-01",
    "external_sale_id": "EXT-001"
  }
]
```

## Expected Test Results

All tests should pass with the following coverage:

- **Unit Tests**: 30+ tests covering service logic
- **Contract Tests**: 20+ tests covering API endpoints
- **Coverage**: >90% for ticket_sales_import_service.py and admin_ticket_sales_import.py
