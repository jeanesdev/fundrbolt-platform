# Phase 0 Research: Quick Bid Entry

## Decision 1: Winner assignment behavior
- Decision: `Assign winner` sets winner to the current highest valid bid after confirmation.
- Rationale: Matches clarified business rule, minimizes operator ambiguity, and keeps close-of-bid action deterministic.
- Alternatives considered:
  - Manual row selection for winner (rejected: slower, higher operator error risk)
  - Allow override from highest bid (rejected: introduces dispute-prone workflow not requested)

## Decision 2: Equal-bid tie resolution
- Decision: For equal amounts on the same item, earliest accepted bid wins (`first-in wins`).
- Rationale: Standard auction policy, deterministic ordering for concurrency, and simple for audit/reconciliation.
- Alternatives considered:
  - Last-in wins (rejected: less intuitive in live auction operations)
  - Reject duplicate amount bids (rejected: would block realistic bidding behavior)
  - Manual tie-break at close (rejected: introduces extra operational complexity)

## Decision 3: Access control scope
- Decision: Restrict quick entry to Super Admin, NPO Admin, and NPO Staff.
- Rationale: Aligns with clarified role scope and least-privilege principles while enabling operational staff access.
- Alternatives considered:
  - Any authenticated admin-area user (rejected: over-broad)
  - Event-specific assignment-only role check (deferred: higher implementation coupling than required now)

## Decision 4: Unmatched bidder handling
- Decision: Reject submission if bidder number is unmatched; show immediate error and keep rapid-entry flow active.
- Rationale: Preserves financial data integrity and avoids orphaned bids/donations while maintaining speed.
- Alternatives considered:
  - Create unassigned records for later reconciliation (rejected: increases cleanup risk)
  - Allow unmatched in Paddle Raise only (rejected: inconsistent behavior and reporting complexity)

## Decision 5: Paddle Raise label policy
- Decision: Donation labels are optional; valid donations can be saved with no labels.
- Rationale: Keeps operator throughput high and prevents metadata from blocking pledge capture.
- Alternatives considered:
  - Require at least one label (rejected: unnecessary entry friction)
  - Conditional requirement based on custom label field (rejected: unclear operator mental model)

## Decision 6: Contract style for this feature
- Decision: Add focused REST admin endpoints under event scope for quick-entry create/delete/summary/winner actions.
- Rationale: Aligns with existing API-first/REST-first platform constitution and existing admin event patterns.
- Alternatives considered:
  - Real-time socket-only entry endpoint (rejected: not required for initial scope)
  - Consolidated single polymorphic endpoint for all actions (rejected: poorer contract clarity)

## Decision 7: Observability and audit expectations
- Decision: Record create/delete/assign actions with actor and timestamp in existing audit trail; expose summary values via read endpoint.
- Rationale: Required by spec FR-021 and constitution security/observability principles.
- Alternatives considered:
  - UI-only derived summary without persisted audit action trails (rejected: non-compliant with audit requirement)

## Decision 8: Performance and concurrency posture
- Decision: Optimize for keyboard throughput and deterministic ranking under concurrent writes; update summary within 1 second for 95% of create/delete actions.
- Rationale: Directly maps to success criteria SC-001 and SC-005 and real-time reliability constitution goals.
- Alternatives considered:
  - Deferred summary updates in background batches (rejected: weak operator feedback during live events)
