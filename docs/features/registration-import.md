# Registration Import Feature

## Overview

The Registration Import feature allows event administrators to bulk import event registrations from JSON, CSV, or Excel files. This feature follows the same pattern as the Auction Item Import, with a two-step process:

1. **Preflight**: Validate the file without creating any records
2. **Confirm**: Create registration records for validated rows

## User Interface

### Location
- Admin PWA → Events → Registrations tab → "Import" button

### Dialog Flow
1. Click "Import" button
2. Select a file (JSON, CSV, or Excel)
3. Click "Run Preflight" to validate
4. Review validation results
5. Click "Confirm Import" to create records

### Features
- Real-time validation feedback with error/warning badges
- Row-level error messages
- Example format display (JSON/CSV templates)
- Progress indicators during preflight and commit
- Summary statistics (total, valid, errors, warnings, created, skipped, failed)

## File Formats

### Supported Formats
- **JSON**: Array of registration objects
- **CSV**: Comma-separated values with header row
- **Excel**: .xlsx or .xls files (reads first worksheet)

### Required Fields
All rows must include:
- `registrant_name`: Full name of the registrant
- `registrant_email`: Email address
- `registration_date`: Date in YYYY-MM-DD format
- `ticket_package`: Name of the ticket package (must exist in the event)
- `quantity`: Number of tickets (≥ 1)
- `total_amount`: Total amount paid (≥ 0)
- `payment_status`: Payment status (e.g., "Paid", "Pending", "Completed")
- `external_registration_id`: Unique identifier within the event

### Optional Fields
- `event_id`: Event identifier (informational only, ignored during import)
- `registrant_phone`: Phone number
- `notes`: Additional notes
- `bidder_number`: Auction bidder number (100-999)
- `table_number`: Assigned table number (≥ 1)
- `guest_count`: Number of guests (≥ 1)

## Validation Rules

### Preflight Validation
- **Required Fields**: All required fields must be present and non-empty
- **Data Types**: Validates numeric fields (quantity, amount, bidder_number, table_number)
- **Ticket Package**: Must exist for the selected event
- **External ID Uniqueness**: No duplicates within the file
- **Row Limit**: Maximum 5,000 rows per file
- **Date Format**: registration_date must be YYYY-MM-DD

### Warnings (Non-Blocking)
- **Existing Registrations**: Rows with external_registration_id that already exists will be skipped
- **Event ID Mismatch**: event_id in file is ignored; all rows import to the selected event

### Errors (Blocking)
- Missing or empty required fields
- Invalid data types or formats
- Duplicate external_registration_id within the file
- Non-existent ticket package
- Negative amounts or invalid quantity
- Row count exceeds 5,000

## Example Files

### JSON Format
```json
[
  {
    "event_id": "EVT-2026-001",
    "registrant_name": "Jordan Lee",
    "registrant_email": "jordan.lee@example.org",
    "registration_date": "2026-02-01",
    "ticket_package": "VIP Table",
    "quantity": 2,
    "total_amount": 500.00,
    "payment_status": "Paid",
    "external_registration_id": "REG-100045",
    "registrant_phone": "555-123-4567",
    "bidder_number": 42,
    "table_number": 8,
    "guest_count": 2,
    "notes": "Sponsor package"
  }
]
```

### CSV Format
```csv
event_id,registrant_name,registrant_email,registration_date,ticket_package,quantity,total_amount,payment_status,external_registration_id,registrant_phone,bidder_number,table_number,guest_count,notes
EVT-2026-001,Jordan Lee,jordan.lee@example.org,2026-02-01,VIP Table,2,500.00,Paid,REG-100045,555-123-4567,42,8,2,Sponsor package
```

Example files are available in `/tmp/registration-import-examples/`:
- `registrations-valid.json`
- `registrations-valid.csv`

## API Endpoints

### Preflight Import
```
POST /api/v1/admin/events/{event_id}/registrations/import/preflight
Content-Type: multipart/form-data
```

**Request**: File upload (field name: `file`)

**Response**: ImportReport with validation results

### Confirm Import
```
POST /api/v1/admin/events/{event_id}/registrations/import/commit
Content-Type: multipart/form-data
```

**Request**: File upload (field name: `file`)

**Response**: ImportReport with creation results

## Database Schema

### Tables Created
- `registration_import_batches`: Tracks each import attempt
- `registration_validation_issues`: Stores validation errors/warnings per row

### Enum Types
- `import_batch_status`: preflight, completed, failed
- `validation_severity`: error, warning

## Implementation Status

### Completed ✅
- [x] Backend models (ImportBatch, ValidationIssue)
- [x] Alembic migration for new tables
- [x] Pydantic schemas for API
- [x] File parsing (JSON, CSV, Excel)
- [x] Preflight validation logic
- [x] API endpoints (preflight, commit)
- [x] Audit logging
- [x] Frontend service client
- [x] TypeScript types
- [x] RegistrationImportDialog component
- [x] Import button in EventRegistrationsSection
- [x] Example format display

### Pending 🚧
- [ ] Registration record creation implementation
- [ ] External registration ID tracking (requires EventRegistration model update)
- [ ] Error report download endpoint
- [ ] End-to-end testing with live backend

## Known Limitations

1. **Registration Creation Stub**: The `_create_registration` method in the service is currently a stub and needs full implementation to:
   - Create or find user records for registrants
   - Create EventRegistration records
   - Create RegistrationGuest records for multiple guests
   - Link to ticket packages
   - Store external_registration_id (model update needed)

2. **External ID Field**: EventRegistration model needs an `external_registration_id` field to support idempotent imports

## Testing Checklist

- [ ] Upload valid JSON file → Preflight passes → Commit creates records
- [ ] Upload valid CSV file → Preflight passes → Commit creates records
- [ ] Upload valid Excel file → Preflight passes → Commit creates records
- [ ] Upload file with missing required field → Preflight fails with error
- [ ] Upload file with duplicate external_id in file → Preflight fails with error
- [ ] Upload file with existing external_id → Preflight passes with warning → Commit skips duplicate
- [ ] Upload file with non-existent ticket package → Preflight fails with error
- [ ] Upload file exceeding 5,000 rows → Preflight fails with error
- [ ] Upload file with invalid date format → Preflight fails with error
- [ ] Upload file with negative amount → Preflight fails with error

## Future Enhancements

- Add error report CSV download
- Support for bulk guest information import
- Support for custom field mapping
- Real-time progress updates during commit
- Rollback capability for failed imports
- Import history and audit trail UI
