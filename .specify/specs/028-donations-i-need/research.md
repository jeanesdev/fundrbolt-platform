# Research: Donation Tracking and Attribution

## Decision 1: Use soft-delete semantics for donation removal (`voided` lifecycle)
- **Decision**: Donation "deletion" is implemented as a void action that preserves record history and excludes voided records from default active listings.
- **Rationale**: This preserves financial traceability and aligns with event analytics and audit expectations.
- **Alternatives considered**:
  - Hard delete donation records (rejected: loses historical accuracy and weakens auditability)
  - Hard delete for admins only (rejected: creates inconsistent analytics behavior and risk of accidental data loss)

## Decision 2: Scope labels to events
- **Decision**: Donation labels are event-specific and managed per event.
- **Rationale**: Prevents cross-event tagging contamination and keeps analytics contextually accurate.
- **Alternatives considered**:
  - Global shared labels (rejected: ambiguous semantics across events)
  - Hybrid global + event enable/disable (rejected for now: additional complexity beyond immediate requirements)

## Decision 3: Default multi-label filtering to `ALL` with optional `ANY`
- **Decision**: Query behavior defaults to returning donations matching all selected labels, with explicit mode switch to any-label matching.
- **Rationale**: Default strict matching supports precise operational and analytics queries; optional broader mode supports exploration use cases.
- **Alternatives considered**:
  - Default ANY (rejected: less precise by default)
  - ALL-only without toggle (rejected: limits analytic flexibility)

## Decision 4: Require event and donor linkage per donation
- **Decision**: Each donation references exactly one donor/user and exactly one event.
- **Rationale**: Donation context and ownership are mandatory for downstream reporting, security scoping, and attribution integrity.
- **Alternatives considered**:
  - Optional event linkage (rejected: breaks event-scoped analytics)
  - Optional donor linkage (rejected: breaks accountability and donor reporting)

## Decision 5: Allow multiple donations by same donor in same event
- **Decision**: No uniqueness constraint on `(event_id, donor_id)`; a donor may submit many donations per event.
- **Rationale**: Supports real event behavior (multiple paddle-raise moments, incremental commitments).
- **Alternatives considered**:
  - One donation per donor per event (rejected: cannot represent common fundraising behavior)
  - One per donor+label-set (rejected: unnecessary complexity and brittle semantics)

## Decision 6: Enforce role boundaries for write operations
- **Decision**: Admin/staff roles can create/update/void donations and manage labels; reporting roles are read-only.
- **Rationale**: Reduces risk for financial records while preserving access for analytics/reporting users.
- **Alternatives considered**:
  - Any authenticated event user can write (rejected: too permissive for sensitive financial actions)
  - Admin-only for all operations (rejected: operationally restrictive)

## Decision 7: Model label assignment as explicit many-to-many entity
- **Decision**: Use a dedicated donation-label assignment entity with timestamps.
- **Rationale**: Supports multi-label tagging, historical retention, and efficient filtering.
- **Alternatives considered**:
  - Store labels as serialized list in donation record (rejected: weak integrity and query ergonomics)
  - Single label per donation field (rejected: does not satisfy requirements)
