# Research: Auctioneer Dashboard

**Feature**: 038-auctioneer-dashboard
**Date**: 2026-04-04

## R1: Auctioneer Role Integration into Existing RBAC

**Decision**: Add `auctioneer` as a new role in the `roles` table and a new `AUCTIONEER` value in the `MemberRole` enum (NPO member level). The auctioneer role operates at NPO scope (like `event_coordinator`) with `npo_id` set on the user record.

**Rationale**: The existing role system has two layers — platform roles (users.role_id → roles table) and NPO member roles (npo_members.role). The auctioneer needs both: a platform role for permission checks (`role_name == "auctioneer"`) and an NPO membership for tenant isolation. This mirrors how `event_coordinator` works today.

**Alternatives considered**:
- Using only NPO member role without platform role: Rejected because platform-level permission checks (PermissionService) use `role_name` from the users table, and the admin UI navigation is gated on platform roles.
- Using the existing `staff` role with a flag: Rejected because auctioneers have fundamentally different permissions (auction item edit, commission data access) that don't align with staff's check-in-focused scope.

## R2: Invitation System Extension for Auctioneer Role

**Decision**: Extend the existing invitation system to support `role="auctioneer"` as a valid invitation role. The invitation flow (create → email → accept → NPOMember creation) remains identical; only the role value and the check constraint on the roles table need updating.

**Rationale**: The invitation model stores role as a string (`admin`, `co_admin`, `staff`). Adding `auctioneer` requires: (1) updating the `MemberRole` enum to include `AUCTIONEER`, (2) updating the roles table check constraint to include `auctioneer`, (3) no changes to `InvitationService.create_invitation()` or `accept_invitation()` — they already pass through the role string generically.

**Alternatives considered**:
- Creating a separate auctioneer-specific invitation flow: Rejected per YAGNI — the existing flow handles all the needed behavior (token generation, email, expiry, acceptance, NPOMember creation).

## R3: Commission Data Isolation Strategy

**Decision**: Store auctioneer commission data in a separate `auctioneer_item_commissions` table (not as columns on auction_items) to support multiple auctioneers per event with independent commission data. API responses conditionally include commission data based on the requesting user's role.

**Rationale**: The spec requires that multiple auctioneers can have independent commissions on the same item (FR-019), and that commission data is only visible to the owning auctioneer and Super Admins (FR-008). A separate table with (auctioneer_user_id, auction_item_id) as a unique constraint cleanly models this. API endpoints filter by `current_user.id` to return only the requesting auctioneer's data.

**Alternatives considered**:
- JSONB column on auction_items storing per-auctioneer commission maps: Rejected because it makes querying, validation, and access control more complex. Dedicated table enables standard SQLAlchemy relationships and straightforward permission filtering.

## R4: Earnings Calculation Logic (No Double-Counting)

**Decision**: Earnings are calculated as: (1) For items WITH per-item commissions: `(winning_bid × commission_%) + flat_fee`, (2) For items WITHOUT per-item commissions: their revenue contributes to the category pool, which is multiplied by the category-level percentage. Items with per-item commissions are excluded from the category-level pool.

**Rationale**: Clarified in spec (Session 2026-04-04, Q1). The auctioneer either earns via per-item commission OR via category percentage on that item — never both. This prevents unexpected double-counting and gives auctioneers fine-grained control over high-value items while maintaining a baseline percentage on the rest.

**Alternatives considered**:
- Additive model (both apply): Rejected by user as potentially confusing and hard to forecast.
- Override model (per-item replaces category): Similar to chosen approach but semantically different — the chosen model is clearer about what the "category revenue pool" includes.

## R5: Real-Time Bid Updates for Live Auction Tab

**Decision**: Extend the existing Socket.IO infrastructure to emit `auction:bid_placed` events to an event-wide room. The auctioneer's Live Auction tab subscribes to this room and filters for the current live auction item client-side.

**Rationale**: The existing Socket.IO server (notification_ws.py) uses Redis-backed pub/sub and supports room-based messaging. Currently it handles notification events; adding a new `auction:bid_placed` event type follows the same pattern. The room format `event:{event_id}` broadcasts to all connected users for that event, and the client filters by item_id.

**Alternatives considered**:
- Per-item rooms (room per auction item): Rejected because live auction items change frequently, requiring constant room joins/leaves. An event-wide room with client-side filtering is simpler.
- Polling: Rejected because the constitution requires <500ms propagation for bid updates.

## R6: Event Timing Fields

**Decision**: Map the existing `auction_close_datetime` column (from migration 032) in the Event model. Add a new `live_auction_start_datetime` column via migration. Both are optional DateTime(timezone=True) fields.

**Rationale**: The `auction_close_datetime` column already exists in the database (migration 032) but isn't mapped in the SQLAlchemy model. Adding the mapping is zero-risk. The `live_auction_start_datetime` is new and needed for the countdown timer feature. Both are optional because not all events have live auctions or scheduled silent auction close times.

**Alternatives considered**:
- Storing times in a separate event_schedule table: Rejected per YAGNI — two simple nullable columns on the existing Event model are sufficient.

## R7: Auctioneer Access to Existing Event Dashboard

**Decision**: Auctioneers can view the existing Event Dashboard (EventDashboardPage) in read-only mode, in addition to their own Auctioneer Dashboard.

**Rationale**: Clarified in spec (Session 2026-04-04, Q2). The auctioneer benefits from seeing overall event performance (revenue waterfall, pacing) alongside their personal earnings view. The existing Event Dashboard is already read-only for non-admin roles; adding `auctioneer` to the role check is minimal.

**Alternatives considered**:
- Restricting auctioneer to only their dashboard: Rejected by user — auctioneers benefit from full event context.
