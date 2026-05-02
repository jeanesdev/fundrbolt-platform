# Research: Revenue Generators

**Feature**: 042-revenue-generators
**Date**: 2026-05-01

## R1: Random Draw Weighting Strategy

**Decision**: Use Python `random.choices(population, weights)` where `population` is a list of all entry records and `weights` is a list of all-ones (each entry weighted equally). The natural outcome is proportional win probability: a donor with 5 entries has 5× the probability of a donor with 1 entry.

**Rationale**: `random.choices` is stdlib (no new dependency), handles weighted sampling correctly in O(n), and is trivially auditable. Each entry row is a discrete ticket — the selection picks one row from the full list, which naturally satisfies FR-013 ("each individual entry an equal probability of being chosen").

**Alternatives considered**:
- **Shuffle-and-pop**: `random.shuffle(entries); winner = entries[0]` — semantically equivalent but wastes memory allocating a shuffled copy of a potentially large list.
- **numpy / weighted sampling lib**: Over-engineering for this use case; introduces an optional dependency with no additional capability.
- **Deduplicate to donors then weight by count**: Produces the same result but is harder to reason about and harder to audit — the raw entry list approach maps directly to the "each ticket" mental model in the spec.

## R2: Entry Recording Pattern

**Decision**: Store one row per entry in `revenue_generator_entries`. Fields: `event_id` (denormalized for query performance), `revenue_generator_item_id`, `registration_guest_id` (FK SET NULL — preserves entry if guest deleted), `bidder_number` (INTEGER, denormalized snapshot), `amount_paid` (NUMERIC), `recorded_by_user_id` (nullable — NULL = donor self-purchased via donor app), `purchased_at` (TIMESTAMP NOT NULL DEFAULT now()).

**Rationale**: Mirrors the `quick_entry_live_bids` pattern which already stores `bidder_number` as a denormalized field for fast lookup and to preserve the value even if the guest record changes. No displacement or outbid mechanics are needed — entries are append-only. `recorded_by_user_id = NULL` distinguishes self-service donor purchases from staff-recorded Quick Entry submissions without adding a separate boolean flag.

**Alternatives considered**:
- **Entry count column on item**: Rejected — a denormalized counter creates consistency risks and prevents accurate per-donor attribution needed for winner selection.
- **Separate donor-purchase and staff-purchase tables**: Rejected per YAGNI — they are functionally identical; the `recorded_by_user_id` nullable field is sufficient to distinguish them.

## R3: Visibility + Entry Status State Model

**Decision**: Two independent boolean columns on `revenue_generator_items`: `is_visible` (DEFAULT false) and `is_open_for_entries` (DEFAULT true). All four combinations are valid and independently toggleable.

**Rationale**: The spec explicitly clarifies (Session 2026-05-01, Q1) that the two states are independent. An enum state machine (e.g., `draft`, `active`, `closed`, `hidden`) would force a fixed relationship between visibility and openness, preventing valid combinations like "visible but closed for entries" (donors see results) or "hidden but open" (admin prep before reveal). Two booleans are simpler to implement, simpler to test, and exactly match the spec's independent control requirement (FR-006).

**Alternatives considered**:
- **Single state enum** (`draft` / `active` / `closed` / `archived`): Rejected — conflates two orthogonal concerns, would require a 4-value enum with non-obvious transitions, and doesn't cleanly represent all four valid combinations.
- **Single `status` + `is_visible` hybrid**: Rejected — still creates coupling between the two controls; boolean pair is cleaner.

## R4: Winner History Strategy

**Decision**: Append-only `revenue_generator_winner_selections` table. The "current winner" for display purposes is the record with the latest `selected_at` timestamp. All prior selections (overrides, re-draws) are retained with their original timestamps and `selected_by_user_id`. No soft-delete or `is_current` flag needed.

**Rationale**: The spec requires full history of all selections including overrides (FR spec US4, acceptance scenario 6). Using `ORDER BY selected_at DESC LIMIT 1` for current winner is a trivial query. Append-only prevents accidental data loss. The admin who performed each selection is captured via `selected_by_user_id` for audit compliance (constitution: "log everything").

**Alternatives considered**:
- **`is_current` boolean on each row**: Rejected — requires an update on the previous record every time a new winner is selected, creating a two-step write that can fail partially. Append-only with `MAX(selected_at)` is atomic and safe.
- **`current_winner_entry_id` FK on the item table**: Rejected — mixes current state into the item record without preserving history; would need a separate history table anyway.

## R5: Dashboard Aggregation Strategy

**Decision**: Query-time aggregation via SQLAlchemy `func.count()` and `func.sum()` on `revenue_generator_entries` filtered by `event_id`. Aggregations run synchronously in the existing `event_dashboard_service.py` and `auctioneer_service.py`. Redis caching deferred until measured performance degradation.

**Rationale**: P3 user stories (US5, US6) are dashboard views. For the event scale described (100+ concurrent donors, spec assumption), a few hundred entries per event is the expected order of magnitude — aggregating at query time with indexed `event_id` columns is fast. Consistent with how existing silent auction dashboard tallies are computed. Premature caching violates YAGNI.

**Alternatives considered**:
- **Denormalized counters on item**: Rejected — consistency risk, overkill for P3 features.
- **Materialized views**: Rejected — adds infrastructure complexity; adds value only at 10,000s of entries per event, which is well beyond current scale targets.

## R6: Quick Entry Integration Pattern

**Decision**: Add a new `revenue_generators` tab to the existing `admin_quick_entry.py` router. New endpoints follow the naming convention already established for `live-auction` and `paddle-raise` tabs: `/admin/events/{event_id}/quick-entry/revenue-generators/...`. New Pydantic schemas added to `backend/app/schemas/quick_entry/schemas.py`.

**Rationale**: The spec requires a dedicated Revenue Generators tab in Quick Entry (FR-009, FR-010). The existing Quick Entry router already manages multiple tabs (live-auction, paddle-raise) with the same URL prefix pattern. Adding a third tab to the same router is minimal change, consistent with existing patterns, and avoids creating a new router for what is functionally a new tab in an existing tool.

**Alternatives considered**:
- **Separate router file**: Rejected — the tabs share the same admin permission model and URL prefix; a separate file would require duplicating the prefix and permission setup with no benefit.
- **Generalized polymorphic entry endpoint**: Rejected — would obscure the per-tab validation rules (RG has item selection + bidder; live auction has item + amount; paddle raise has amount + labels) and complicate OpenAPI documentation.

## R7: Donor "Play" Tab Visibility

**Decision**: The "Play" tab is conditionally rendered in the donor PWA only when at least one visible Revenue Generator item exists for the event. The tab visibility is determined by checking if the list endpoint returns any items. No separate "tab visibility" API endpoint needed.

**Rationale**: The spec states (Assumption): "The 'Play' tab is only visible to donors when at least one visible Revenue Generator item exists." The donor list endpoint already returns only visible items. The frontend can conditionally render the tab based on the response (non-empty = show tab, empty = hide tab). This avoids a redundant metadata endpoint (YAGNI).

**Alternatives considered**:
- **Separate `/play-tab-enabled` endpoint**: Rejected per YAGNI — the item list endpoint already provides this information.
- **Always-visible tab with empty state**: Rejected — spec is explicit that the tab should only appear when there are visible items.

## R8: Auctioneer Dashboard Refresh Pattern

**Decision**: Use client-side polling interval (consistent with existing auctioneer dashboard implementation) rather than adding new Socket.IO channels. No changes to WebSocket infrastructure.

**Rationale**: The spec states "near-real-time refresh" for US6 and clarifies this is "consistent with existing dashboard behavior" in the assumptions. The auctioneer dashboard already uses a polling approach. Adding a new WebSocket event type for Revenue Generator entries violates YAGNI for a P3 feature that matches existing behavior.

**Alternatives considered**:
- **New Socket.IO `rg:entry_added` event**: Rejected per YAGNI — polling already exists; constitution's 500ms WebSocket requirement applies to bid updates (core auction flow), not dashboard refresh.
- **Server-sent events (SSE)**: Rejected — adds a new infrastructure pattern to the codebase without being specified.
