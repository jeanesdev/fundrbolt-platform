# Research: Duplicate Event

**Feature**: 031-duplicate-event
**Date**: 2025-03-04
**Purpose**: Resolve all NEEDS CLARIFICATION items and document technology decisions.

## Research Findings

### R1: Event Duplication Strategy (Data Cloning)

**Decision**: Use SQLAlchemy ORM-level cloning — load the source event with all relationships, create new model instances with copied attributes, and persist in a single transaction.

**Rationale**: The existing codebase uses SQLAlchemy 2.0 with async sessions. ORM-level cloning is the simplest approach that works with the existing model relationships (`food_options`, `ticket_packages`, `tables`, `sponsors`, `media`, `links`, `donation_labels`). Each child record gets a new UUID via `UUIDMixin`, and the `event_id` foreign key is set to the new event's ID. This avoids raw SQL and keeps all validation logic intact.

**Alternatives considered**:
- Raw SQL `INSERT...SELECT` — faster for large datasets but bypasses ORM validation, hard to maintain, and doesn't handle UUID generation cleanly.
- Database-level trigger/function — too tightly coupled to DB, hard to test, doesn't support conditional cloning (media opt-in/out).

### R2: Azure Blob Storage Deep-Copy for Media

**Decision**: Use Azure Blob Storage's server-side `start_copy_from_url()` API (async copy) to deep-copy media blobs. Generate new blob names under the new event's namespace.

**Rationale**: Azure Blob Storage supports server-side copy which is fast (no data transfer through the app server) and cost-efficient. The existing `MediaService` already has blob client infrastructure. For the 50MB-per-event media limit, server-side copy completes in seconds. We'll poll for copy completion for each blob.

**Alternatives considered**:
- Client-side download+upload — slow, doubles bandwidth usage.
- Shared blob references — rejected during clarification (user chose independent copies).

### R3: Slug Generation for Duplicated Events

**Decision**: Reuse the existing `EventService._generate_unique_slug()` method, passing the new event name ("{Original Name} (Copy)") to generate a unique slug.

**Rationale**: The codebase already handles slug uniqueness by appending numeric suffixes when conflicts occur. No new logic needed.

### R4: Authorization Pattern

**Decision**: Reuse the existing `PermissionService.can_view_event()` pattern used in ticket package endpoints. The user must have access to the source event's NPO to duplicate it.

**Rationale**: Follows the established authorization pattern in the codebase. No new permission types needed — if you can view/manage an event, you can duplicate it.

### R5: Ticket Package Cloning — Fields to Reset

**Decision**: Clone all fields except: `id` (new UUID), `event_id` (new event), `created_by` (current user), `sold_count` (reset to 0), `version` (reset to 1), `created_at`/`updated_at` (new timestamps). Preserve: `name`, `description`, `price`, `seats_per_package`, `quantity_limit`, `display_order`, `image_url`, `is_enabled`, `is_sponsorship`. Also clone `CustomTicketOption` children.

**Rationale**: Per clarification, ticket packages keep their active/inactive state (`is_enabled`). Only transactional data (`sold_count`) and identity fields are reset. Custom ticket options are configuration (not transactional) so they're cloned too.

### R6: Frontend Dialog Pattern

**Decision**: Use a Radix UI `AlertDialog` (from shadcn/ui) for the duplication confirmation, matching the existing pattern used for delete confirmations. Add checkboxes for the three optional inclusion toggles (media, links, donation labels).

**Rationale**: Consistent with existing UI patterns in the admin app. `AlertDialog` blocks interaction until confirmed, preventing accidental double-clicks.

### R7: Sponsor Cloning — Logo References

**Decision**: Create new `Sponsor` records with the same `logo_url`, `logo_blob_name`, `thumbnail_url`, and `thumbnail_blob_name` values (shared blob references). Each sponsor gets a new UUID and belongs to the new event.

**Rationale**: Per spec assumptions, sponsor logos are reusable assets. Shared references avoid blob duplication costs. If a sponsor's logo is later updated on the copy, the admin uploads a new file (creating a new blob), so there's no risk of cross-event interference.

## No Unresolved Items

All NEEDS CLARIFICATION items were resolved during the `/speckit.clarify` phase. No outstanding unknowns remain.
