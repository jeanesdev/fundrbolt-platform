# Phase 0 Research: Import Auction Bids

## Decisions

### Donor identifier for imports
- **Decision**: Use donor email as the unique donor identifier.
- **Rationale**: Email is stable, human-readable, and consistent with demo data imports.
- **Alternatives considered**: Internal donor IDs; phone number; name matching.

### Auction item identifier for imports
- **Decision**: Use auction item code/number as the item identifier.
- **Rationale**: Item codes are stable and easy to verify during preflight.
- **Alternatives considered**: Internal item IDs; mixed ID/code support.

### Partial import behavior
- **Decision**: Block confirmation if any row is invalid.
- **Rationale**: Prevents accidental partial imports and keeps data integrity.
- **Alternatives considered**: Import valid rows only; partial import with warnings.

### Bid timestamp handling
- **Decision**: Accept any valid date-time value without rejecting future timestamps.
- **Rationale**: Demo/test setup may include synthetic or future times.
- **Alternatives considered**: Reject future times; enforce event-time bounds.

### Duplicate row handling
- **Decision**: Treat exact duplicate rows as errors in preflight.
- **Rationale**: Avoids accidental double-bids and keeps imports deterministic.
- **Alternatives considered**: Allow duplicates as separate bids; auto-de-duplicate.

### Import flow structure
- **Decision**: Two-step preflight then confirm with atomic creation.
- **Rationale**: Aligns with existing import patterns and minimizes risk of invalid data creation.
- **Alternatives considered**: Single-step import; background import with delayed validation.
