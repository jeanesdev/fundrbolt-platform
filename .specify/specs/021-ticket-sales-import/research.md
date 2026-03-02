# Phase 0 Research: Ticket Sales Import

## Decision 1: File parsing approach
- **Decision**: Use native JSON/CSV parsing for `.json`/`.csv` and an Excel reader for `.xlsx` files.
- **Rationale**: Minimizes dependencies for JSON/CSV while enabling Excel support; keeps import logic predictable and aligned with a fixed schema.
- **Alternatives considered**: Use a unified data parsing library for all formats (heavier dependency and less control over validation).

## Decision 2: Preflight result handling
- **Decision**: Preflight returns a summary and row-level issues, and produces a `preflight_id` used to authorize the import.
- **Rationale**: Ensures imports only occur after a validated file and prevents accidental import of a different file.
- **Alternatives considered**: Direct import without preflight (violates requirements); preflight without an ID (risk of mismatched file).

## Decision 3: Duplicate handling for existing `external_sale_id`
- **Decision**: Preflight passes with warnings and those rows are skipped during import.
- **Rationale**: Avoids duplicate sales while allowing clean rows to proceed; surfaces issues to admins.
- **Alternatives considered**: Hard fail preflight (blocks otherwise valid rows); overwrite existing records (risk of data loss).

## Decision 4: `event_id` handling in files
- **Decision**: Ignore `event_id` in file and import into the currently selected event.
- **Rationale**: Prevents cross-event mistakes and simplifies admin workflow for a single event context.
- **Alternatives considered**: Enforce match (adds friction); multi-event imports (out of scope).

## Decision 5: Import size limit
- **Decision**: Enforce a maximum of 5,000 rows per import.
- **Rationale**: Aligns with performance goals and keeps preflight predictable.
- **Alternatives considered**: 1,000 rows (too restrictive); 10,000 rows (higher risk of timeouts).
