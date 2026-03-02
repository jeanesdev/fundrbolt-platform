# Research: Event Registration Import

## Decision 1: Preflight validation required before import
- **Decision**: Require a preflight step that validates the file and blocks import on any required-field errors.
- **Rationale**: Prevents bad data creation and aligns with existing bulk import workflows.
- **Alternatives considered**: Allow import with invalid rows skipped (rejected due to data integrity risk).

## Decision 2: Duplicate handling for existing registrations
- **Decision**: Preflight passes with warnings for existing `external_registration_id` duplicates; those rows are skipped during import.
- **Rationale**: Maintains idempotency while allowing import to proceed for valid rows.
- **Alternatives considered**: Fail preflight on any duplicate; overwrite existing records.

## Decision 3: Event scope for imports
- **Decision**: Ignore `event_id` in file and import into the selected event, warning on mismatch.
- **Rationale**: Keeps admin context as the source of truth and avoids cross-event data leakage.
- **Alternatives considered**: Require `event_id` and route per row; fail on mismatch.

## Decision 4: Maximum file size
- **Decision**: Limit imports to 5,000 rows per file.
- **Rationale**: Keeps preflight latency predictable and aligns with existing bulk import constraints.
- **Alternatives considered**: 1,000 or 10,000 rows.

## Decision 5: Supported file formats
- **Decision**: Support JSON, CSV, and Excel workbook input formats.
- **Rationale**: Matches source system export options and prior ticket-sales import requirements.
- **Alternatives considered**: Single-format support only.
