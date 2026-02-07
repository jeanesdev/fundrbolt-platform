# Data Model: Ticket Sales Import

## Entities

### TicketSaleRecord
Represents a single ticket sale.

**Fields**
- `id`
- `event_id`
- `ticket_type_id` or `ticket_type_name`
- `purchaser_name`
- `purchaser_email`
- `purchaser_phone` (optional)
- `quantity`
- `total_amount`
- `fee_amount` (optional)
- `payment_status` (optional)
- `purchase_date`
- `external_sale_id` (unique within event)
- `notes` (optional)
- `created_at`
- `created_by`

**Validation Rules**
- Required fields per FR-006.
- `quantity` must be positive integer.
- `total_amount` must be non-negative numeric.
- `external_sale_id` must be unique within the event.
- `ticket_type` must exist for the selected event.

### TicketSalesImportBatch
Represents one upload attempt and its preflight/import outcome.

**Fields**
- `id`
- `event_id`
- `status` (preflighted, imported, failed, canceled)
- `source_filename`
- `source_format` (json, csv, xlsx)
- `row_count`
- `valid_count`
- `error_count`
- `warning_count`
- `preflight_id`
- `preflight_checksum`
- `created_by`
- `created_at`

**Validation Rules**
- `row_count` <= 5000.
- `preflight_id` required for import.

### TicketSalesImportIssue
Represents row-level validation issues from preflight.

**Fields**
- `id`
- `batch_id`
- `row_number`
- `field_name`
- `severity` (error, warning)
- `message`
- `raw_value` (optional)

**Validation Rules**
- Errors block import; warnings allow import with skipped rows where applicable.

## Relationships
- `TicketSalesImportBatch` 1..* `TicketSalesImportIssue`
- `TicketSalesImportBatch` 0..* `TicketSaleRecord` (created from successful import)
- `TicketSaleRecord` belongs to an `Event` and `TicketType`

## State Transitions
- `preflighted` → `imported`
- `preflighted` → `failed` (if import fails)
- `preflighted` → `canceled`
