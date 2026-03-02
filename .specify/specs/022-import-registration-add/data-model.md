# Data Model: Event Registration Import

## Entities

### Registration Record
- **Represents**: A single event registration created from an import row.
- **Key fields**: event_id, registrant_name, registrant_email, registration_date, quantity, external_registration_id
- **Optional fields**: registrant_phone, bidder_number, table_number, guest_count, guest_of_email, food_option, notes, ticket_purchase_id, ticket_purchaser_email, ticket_purchase_date
- **Constraints**:
  - `external_registration_id` must be unique within the selected event
  - Required fields must be present and valid

### Import Batch
- **Represents**: One uploaded file and its preflight/import lifecycle.
- **Key fields**: batch_id, event_id, file_name, file_type, created_by_admin_id, created_at, status (preflighted/imported/failed), totals (rows_total, rows_valid, rows_error, rows_warning)
- **Relationships**:
  - One Import Batch has many Validation Issues
  - One Import Batch creates many Registration Records

### Validation Issue
- **Represents**: A preflight error or warning tied to a specific row and field.
- **Key fields**: batch_id, row_number, field_name, severity (error/warning), message
- **Relationships**: Many Validation Issues belong to one Import Batch

## Validation Rules
- Required fields must be present and valid; any error causes preflight to fail.
- Duplicate `external_registration_id` values within the file are errors.
- Existing `external_registration_id` values in the system are warnings and are skipped during import.
- `event_id` from file is ignored; mismatch triggers a warning only.
- Guest rows (with `guest_of_email`) must reference a parent registrant in the file or system.
- Guest emails must be unique per parent registration.
- Guest rows must not exceed the parent `guest_count` capacity.
- `food_option` must match a food option for the event when provided.
- Maximum 5,000 rows per import.

## State Transitions
- **Import Batch**: uploaded → preflighted (pass/fail) → imported (on confirm) or failed
