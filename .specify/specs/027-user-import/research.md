# Phase 0 Research: Admin User Import

## Decision 1: Import endpoint pattern

- **Decision**: Use three endpoints: preflight, commit, and error-report under `/api/v1/admin/users/import/*` with multipart upload for preflight/commit.
- **Rationale**: Mirrors existing admin import flows and supports the required preflight/confirm sequence.
- **Alternatives considered**:
  - Single endpoint with `mode=preflight|commit` (rejected: less explicit and harder to audit).
  - Preflight-only with client-side confirmation (rejected: does not enforce FR-005).

## Decision 2: Preflight token and file binding

- **Decision**: Preflight returns `preflight_id` and a `file_checksum`; commit requires both plus the file.
- **Rationale**: Ensures confirmation only applies to the same file while keeping the workflow consistent with existing imports.
- **Alternatives considered**:
  - Commit without token (rejected: cannot enforce FR-005 reliably).
  - Commit with token only (rejected: harder to re-validate file integrity if needed).

## Decision 3: Existing user handling across NPOs

- **Decision**: If email exists but not in selected NPO, add membership with imported role; if email already in selected NPO, skip and warn.
- **Rationale**: Enables bulk onboarding without creating duplicates while respecting membership boundaries.
- **Alternatives considered**:
  - Fail preflight on any existing email (rejected: too strict for common onboarding cases).

## Decision 4: Temporary password delivery

- **Decision**: Send welcome or password reset emails to new users and do not expose passwords to admins.
- **Rationale**: Reduces credential exposure and aligns with security constraints.
- **Alternatives considered**:
  - Provide temporary passwords to admins (rejected: higher security risk).

## Decision 5: File format and schema

- **Decision**: Support fixed-schema JSON array and CSV with required headers; no column mapping in this release.
- **Rationale**: Matches existing import patterns and keeps preflight deterministic.
- **Alternatives considered**:
  - Custom column mapping (rejected: out of scope for this feature).
