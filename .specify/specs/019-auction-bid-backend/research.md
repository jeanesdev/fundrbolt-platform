# Research: Auction Bid Backend

**Date**: 2026-02-02

## Decisions

### 1) Proxy bidding tie-breaker
- **Decision**: When proxy bids reach the same effective maximum, the earliest max-bid submission retains the lead; auto-bids continue in minimum increments until the next bid would exceed one bidder’s max.
- **Rationale**: Mirrors common silent auction behavior and avoids oscillation or random outcomes.
- **Alternatives considered**: Latest bid wins (can encourage last-second gaming), random tie-breaker (hard to explain to donors).

### 2) Immutable bid history with administrative adjustments
- **Decision**: All bid changes are represented as new bid records plus an admin action audit entry; no existing bid rows are mutated or deleted.
- **Rationale**: Preserves complete auditability and aligns with the immutable history requirement.
- **Alternatives considered**: In-place updates with audit logs (risk of accidental mutation), soft deletes (less transparent).

### 3) Reporting performance strategy
- **Decision**: Use targeted indexes for common report filters and optional pre-aggregated bidder summary views for analytics-heavy endpoints.
- **Rationale**: Keeps common history queries fast while enabling scalable analytics for large events.
- **Alternatives considered**: Compute all analytics on demand (risk of slow reports), cache-only approach (stale data risk).

### 4) Access control boundary
- **Decision**: All authenticated staff can access reporting; only admins can adjudicate bids or override payment status.
- **Rationale**: Balances operational visibility with protection of sensitive actions.
- **Alternatives considered**: Admin-only for everything (insufficient access), open to bidders (privacy risk).
