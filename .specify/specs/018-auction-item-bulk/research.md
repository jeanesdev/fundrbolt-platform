# Research: Bulk Import Auction Items via Workbook + Images

## Decision 1: Two-phase import (preflight then commit)
- **Decision**: Use a preflight validation step followed by an explicit commit step.
- **Rationale**: Prevents accidental partial writes and provides clear feedback before data changes.
- **Alternatives considered**: Single-step import with rollback; best-effort import that skips bad rows.

## Decision 2: Row-level error reporting with downloadable report
- **Decision**: Return row-level errors (row number, column, message) and provide a downloadable error report.
- **Rationale**: Makes fixes actionable and aligns with common bulk import workflows.
- **Alternatives considered**: Aggregate-only error summaries without row detail.

## Decision 3: Idempotent upsert using external identifiers
- **Decision**: Use the event-scoped external identifier as the unique key for idempotent updates.
- **Rationale**: Enables safe re-imports without duplication and supports iterative corrections.
- **Alternatives considered**: Delete-and-replace imports; manual deduplication.

## Decision 4: ZIP handling safety policy
- **Decision**: Validate ZIP contents without extract-all, enforce path traversal protection, and apply limits on compressed/uncompressed sizes, per-file sizes, and entry count.
- **Rationale**: Prevents Zip Slip/path traversal attacks and protects system resources from ZIP bombs.
- **Alternatives considered**: Sandbox extraction service; no uncompressed size limits.

## Decision 5: File type allowlist and signature checks
- **Decision**: Allow only `.xlsx` for the manifest and a small image allowlist (PNG/JPEG), with extension and signature validation.
- **Rationale**: Reduces risk from spoofed file types or malicious content embedded in uploads.
- **Alternatives considered**: Extension-only checks; broader image type support.
