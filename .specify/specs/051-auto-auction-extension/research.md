# Research: Silent Auction Anti-Sniping Auto-Extension

## Decision 1: Policy Scope
- Decision: Use one auto-extension policy per event, applied to all silent auction items in that event.
- Rationale: Matches admin workflow expectations, keeps behavior consistent within an event, and avoids per-item complexity.
- Alternatives considered:
  - Platform-global policy only: rejected because event operators need event-specific control.
  - Per-item policy: rejected due to excessive UI/operational complexity.

## Decision 2: Trigger Timestamp Authority
- Decision: Evaluate trigger-window eligibility using server bid acceptance time.
- Rationale: Prevents client clock drift and network-latency disputes; ensures auditable behavior.
- Alternatives considered:
  - Client submit timestamp: rejected as untrusted and inconsistent.
  - API receipt-start timestamp: rejected because acceptance is the business event.

## Decision 3: Policy Activation Semantics
- Decision: Saved policy changes apply immediately to subsequent accepted bids only.
- Rationale: Gives operators immediate control while preserving deterministic history.
- Alternatives considered:
  - Lock policy after first bid: rejected for reduced operational control.
  - Deferred activation window: rejected for unnecessary complexity.

## Decision 4: Configuration Bounds
- Decision: Enforce extension duration in 1-10 minutes and max total extension in 0-60 minutes.
- Rationale: Constrains unsafe/accidental values while preserving flexibility for event operators.
- Alternatives considered:
  - No upper bound: rejected due to risk of runaway extensions.
  - Tighter 1-5 and 0-30 bounds: rejected due to potential operational constraints for slower live events.

## Decision 5: Rollout for Existing Events
- Decision: If an event has no policy at rollout, auto-create event policy from system defaults before first extension evaluation.
- Rationale: Avoids dead zones where anti-sniping is unexpectedly unavailable.
- Alternatives considered:
  - Leave off until admin configures: rejected due to inconsistent donor fairness.
  - Block bidding until configured: rejected as operationally disruptive.
