# Research: Configurable Our Cause Card Sections

**Branch**: `050-custom-sections` | **Date**: 2026-06-15

## Decision 1: Rich-Text Storage Format

**Decision**: Store rich text as sanitised HTML.
**Rationale**: The admin WYSIWYG editor (TipTap, already used in this codebase — see `frontend/fundrbolt-admin/src/features/settings/components/content-section.tsx`) outputs HTML. Storing HTML avoids a double-conversion step. Server-side sanitisation with a strict allowlist (bleach or equivalent) ensures XSS is impossible before persistence.
**Alternatives considered**:
- Markdown — simpler storage but TipTap is HTML-first; would require a conversion layer.
- ProseMirror JSON — portable, but increases parse complexity on the donor PWA render path.

## Decision 2: Slide/Video Media Storage

**Decision**: Support both uploaded blobs (Azure Blob Storage) and validated external HTTPS URLs in the same `media_url` field, distinguished by a `media_source` enum (`upload` | `external`).
**Rationale**: Reuses existing Azure Blob upload pattern used by `EventMedia` and `AuctionItem` image uploads. External URL support is a user requirement and reduces friction for video embeds (e.g., YouTube).
**External URL validation**: Validate that the URL scheme is HTTPS and the resolved hostname does not fall within private/loopback/link-local ranges (RFC 1918, 127.0.0.0/8, 169.254.0.0/16, ::1, etc.) — this prevents SSRF. Do NOT perform a live HTTP fetch from the server (many hosts return 405 on HEAD; server-side fetches also carry SSRF risk). Browser-side reachability feedback (via `<video>`/`<img>` error events in the admin editor) is preferable for UX.
**Alternatives considered**:
- Server-side HEAD request for reachability — rejected due to SSRF risk and 405 false-negatives on common CDN/streaming hosts.
- Uploads only — rejected because admins asked for external URL support for video.
- External URLs only — rejected because uploads give content persistence guarantees.

## Decision 3: Draft/Publish Model

**Decision**: Per-event card layout uses a version-pointer model. `event_cause_page_config` stores `draft_version` (incremented on every draft mutation) and `published_version` (set to `draft_version` on Publish). Cards in `cause_section_cards` are stored per `(event_id, draft_version)`. The live Our Cause page reads cards where `draft_version = published_version` on the config row. Publish simply sets `published_version = draft_version` — no row copying.
**Rationale**: Simplest model that satisfies FR-016 and FR-017. The donor PWA always reads from the published version via a single filter. Admins read the current `draft_version`. This also naturally supports the audit trail (FR-015).
**Alternatives considered**:
- Physically copying rows to a "published" table — adds write amplification and complexity with no benefit.
- Per-card draft state — adds complexity; two cards in different states is confusing UX.
- Event-level published_at timestamp only — too coarse, no clean diff between draft and live.

## Decision 4: Conflict Detection

**Decision**: Optimistic concurrency using `draft_version` integer on the event's cause-page config row. Admin client includes the last-seen `draft_version` in every mutating request. Server rejects with 409 Conflict if versions differ. Client shows a conflict resolution modal.
**Rationale**: Standard pattern, trivially implemented with a checked UPDATE. No Redis locks required. Matches the existing `version` pattern used on other models in this codebase.
**Alternatives considered**:
- Pessimistic lock — poor UX, admin blocked if another tab is open.
- ETag header approach — same semantics, client would still need version integer for UI logic.

## Decision 5: Ordering Mechanism

**Decision**: `display_order` integer column on `cause_section_cards`, unique per `(event_id, draft_version)`. Reorder operation issues a bulk PATCH with all IDs and their new positions.
**Rationale**: Simple, works with existing drag-and-drop patterns in the admin PWA (already used in seating/run-of-show). Avoids fractional-rank complexity.
**Alternatives considered**:
- Fractional ranking (e.g., 1.5 between 1 and 2) — unnecessary for typical card counts (<20).
- Linked list — complex to query in order, no benefit here.

## Decision 6: Built-In Section Cards

**Decision**: Seed a fixed set of `built_in` type cards per event when the cause-page config is first initialized for that event. Each built-in card has a `built_in_section_key` (e.g., `about`, `sponsors`, `event_details`) that maps to the existing donor PWA section components. They behave identically to custom cards for ordering, enable/disable, and style — but their content is not editable (content comes from existing event data). The `built_in_section_key` is immutable.
**Rationale**: Fulfils FR-010 and FR-011 with no changes to existing event data models. The donor PWA renderer uses `built_in_section_key` to inject the correct existing component in the card wrapper.
**Alternatives considered**:
- Separate ordering table just for built-ins — splits the UX unnecessarily.
- Rewrite built-in sections as custom cards — breaks existing feature code and far exceeds scope.

## Decision 7: WCAG 2.1 AA Compliance

**Decision**: Enforce via existing Radix UI primitives (already in use across admin and donor PWAs), explicit `alt` text fields on all image slide items, and keyboard-navigable drag handles in the admin card list (Radix `@dnd-kit` or equivalent). Contrast ratios enforced by picking from existing Tailwind theme tokens rather than free-form colour pickers. Background/border colours are selected from a curated palette, not entered as raw hex.
**Rationale**: Bespoke hex pickers make WCAG AA automated checks impossible. A curated palette (Tailwind semantic tokens) ensures contrast ratios are pre-validated. Radix handles keyboard focus and ARIA roles.
**Alternatives considered**:
- Free-form colour picker — rejected because WCAG compliance cannot be guaranteed.
- No colour customisation — rejected because admin asked for background/border colour control.
