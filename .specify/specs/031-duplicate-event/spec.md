# Feature Specification: Duplicate Event

**Feature Branch**: `031-duplicate-event`
**Created**: 2025-03-04
**Status**: Draft
**Input**: User description: "Add a 'Duplicate Event' action on the event list and event detail page. Clone event details, food options, ticket packages, table configuration, and sponsor associations. Don't clone registrations, bids, seating assignments, or media (offer media as optional). Set cloned event to DRAFT with name '{Original Name} (Copy)'. Clear event_datetime so admin must set a new date."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Duplicate an Existing Event from the Event List (Priority: P1)

An NPO Admin or Event Coordinator views the list of events for their organization. They see a recurring annual gala they ran last year and want to set up next year's edition. They click a "Duplicate" action on the event row. The system creates a new event in DRAFT status with the name "Annual Charity Gala (Copy)", carrying over all the event setup (venue, food menu, ticket tiers, table layout, sponsor logos) but starting fresh with no registrations, bids, or seating assignments. The admin is taken to the new event's edit page where they set the new date and make any adjustments before publishing.

**Why this priority**: This is the core value proposition — saving hours of manual re-entry for recurring events. It's the single most-requested feature from event platform buyers.

**Independent Test**: Can be fully tested by duplicating any existing event and verifying that a new DRAFT event is created with the correct cloned data and no transactional data carried over.

**Acceptance Scenarios**:

1. **Given** an existing event (any status: DRAFT, ACTIVE, or CLOSED), **When** the admin clicks "Duplicate" from the event list, **Then** a new event is created in DRAFT status with the name "{Original Name} (Copy)".
2. **Given** the duplicated event, **When** the admin views it, **Then** the event date is blank and must be set before publishing.
3. **Given** the duplicated event, **When** the admin views its details, **Then** venue information, description, attire, fundraising goal, contact info, and branding (colors, hero transition style) are copied from the original.
4. **Given** the duplicated event, **When** the admin views food options, **Then** all food options from the original are present with the same names, descriptions, and display order.
5. **Given** the duplicated event, **When** the admin views ticket packages, **Then** all ticket packages from the original are present with the same names, prices, descriptions, and configuration.
6. **Given** the duplicated event, **When** the admin views the table configuration, **Then** table count, max guests per table, and any per-table customizations (custom capacity, table names) are copied — but table captain assignments are not.
7. **Given** the duplicated event, **When** the admin views sponsors, **Then** all sponsor associations from the original are present with the same names, logos, tiers, and display order.
8. **Given** the duplicated event, **When** the admin checks registrations, bids, and seating assignments, **Then** all are empty.
9. **Given** the duplicated event, **When** the admin views it, **Then** it has a new unique URL slug (auto-generated from the new name).

---

### User Story 2 - Duplicate an Event from the Event Detail Page (Priority: P1)

An admin is reviewing a past event's detail page. They want to reuse this event's setup for an upcoming event. They click "Duplicate Event" from the event detail/edit page. The behavior is identical to duplicating from the event list.

**Why this priority**: Same core value as US1, just a different entry point. Admins working within an event's details should have equally convenient access to duplication.

**Independent Test**: Can be tested by navigating to any event's detail page, clicking "Duplicate Event", and verifying the same cloning behavior as US1.

**Acceptance Scenarios**:

1. **Given** an event's detail or edit page, **When** the admin clicks "Duplicate Event", **Then** a new DRAFT event is created with the same cloned data as described in US1.
2. **Given** the duplication completes, **When** the admin is redirected, **Then** they land on the new event's edit page ready to configure the date and make changes.

---

### User Story 3 - Optionally Include Media When Duplicating (Priority: P2)

When duplicating an event, the admin is presented with an option to also copy media files (banner images, flyers, event logos) from the original event. By default, media is NOT copied since images often change between event editions. If the admin opts in, the media files are referenced (or copied) into the new event.

**Why this priority**: Media cloning is secondary because images typically change year-to-year (new date on the flyer, updated branding). However, some admins may want to start with last year's images as a baseline. Offering the choice respects both workflows.

**Independent Test**: Can be tested by duplicating an event with and without the "Include media" option checked, verifying media presence or absence on the new event accordingly.

**Acceptance Scenarios**:

1. **Given** the admin initiates event duplication, **When** the duplication dialog appears, **Then** there is an "Include media files" checkbox that is unchecked by default.
2. **Given** the admin checks "Include media files" and confirms duplication, **When** the new event is created, **Then** all media files from the original event are deep-copied to new storage paths and associated with the new event as fully independent files.
3. **Given** the admin leaves "Include media files" unchecked and confirms duplication, **When** the new event is created, **Then** no media files are present on the new event.

---

### User Story 4 - Optionally Include Event Links When Duplicating (Priority: P3)

When duplicating an event, external links (promo videos, social media links, website URLs) are included by default since they often carry over between editions. The admin can uncheck this option if desired.

**Why this priority**: Links are lightweight data and often reusable (e.g., the organization's social media pages). Lower priority because it's a minor enhancement to the duplication dialog.

**Independent Test**: Can be tested by duplicating an event with and without the "Include links" option, verifying link presence or absence.

**Acceptance Scenarios**:

1. **Given** the admin initiates event duplication, **When** the duplication dialog appears, **Then** there is an "Include external links" checkbox that is checked by default.
2. **Given** the admin confirms duplication with links included, **When** the new event is created, **Then** all external links from the original are present on the new event.
3. **Given** the admin unchecks "Include external links" and confirms, **When** the new event is created, **Then** no links are present on the new event.

---

### User Story 5 - Optionally Include Donation Labels When Duplicating (Priority: P3)

When duplicating an event, donation label categories (e.g., "Paddle Raise", "General Fund") are included by default since they typically remain consistent across event editions.

**Why this priority**: Donation labels are simple configuration data that rarely changes. Including them by default reduces setup time with minimal risk.

**Independent Test**: Can be tested by duplicating an event and verifying donation labels are carried over by default.

**Acceptance Scenarios**:

1. **Given** the admin initiates event duplication, **When** the duplication dialog appears, **Then** there is an "Include donation labels" checkbox that is checked by default.
2. **Given** the admin confirms duplication with donation labels included, **When** the new event is created, **Then** all donation label categories from the original are present.

---

### Edge Cases

- What happens when the original event's name is already very long? The system should truncate if needed so "{Name} (Copy)" doesn't exceed the name field's maximum length (255 characters). If the name would exceed the limit, truncate the original name portion to fit.
- What happens if the admin duplicates an event that was already a copy (named "Gala (Copy)")? The new name should be "Gala (Copy) (Copy)". No special de-duplication of the "(Copy)" suffix is needed.
- What happens if the generated slug for the copy conflicts with an existing slug? The system should auto-generate a unique slug using the same uniqueness logic used for regular event creation (appending a numeric suffix).
- What happens if the admin does not have permission to view or manage the source event? The duplicate action should not be visible or accessible. If attempted directly, the system should return an authorization error.
- What happens if the source event is deleted while the duplication is in progress? The system should return a clear error indicating the source event no longer exists.
- What happens if sponsor logos reference external blob storage URLs from the original event? The sponsor records on the cloned event should reference the same logo URLs (shared reference, not a file copy) since logos are typically reused across events.
- What happens if media deep-copy takes longer than expected (many large files)? The system shows a loading spinner during the synchronous operation. Since events are limited to 50MB total media, this should complete within seconds in most cases.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized users (NPO Admin, Event Coordinator, Super Admin) to duplicate any event they have access to.
- **FR-002**: System MUST create the duplicated event in DRAFT status regardless of the source event's status.
- **FR-003**: System MUST set the duplicated event's name to "{Original Name} (Copy)", truncating the original name if necessary to stay within the 255-character limit.
- **FR-004**: System MUST clear the event date/time on the duplicated event so the admin is required to set a new date before publishing.
- **FR-005**: System MUST generate a new unique URL slug for the duplicated event.
- **FR-006**: System MUST copy the following from the source event: venue details (name, address, city, state, zip), description, tagline, attire, fundraising goal, primary contact info, branding colors (primary, secondary, background, accent), hero transition style, and timezone.
- **FR-007**: System MUST duplicate all food options from the source event, preserving names, descriptions, and display order.
- **FR-008**: System MUST duplicate all ticket packages from the source event, preserving names, descriptions, pricing, configuration, and active/inactive status — but reset any sold counts or purchase-specific data.
- **FR-009**: System MUST duplicate the table configuration, including table count, max guests per table, and per-table customizations (custom capacity, table names) — but NOT table captain assignments or guest seating assignments.
- **FR-010**: System MUST duplicate all sponsor associations from the source event, preserving names, logo references, tiers, donation amounts, display order, and other sponsor metadata. Logo files are referenced (not copied) since they are reusable assets.
- **FR-011**: System MUST NOT copy registrations, guests, bids, auction items, seating assignments, promo codes, ticket purchases, donations, or meal selections.
- **FR-012**: System MUST present a confirmation dialog before proceeding with duplication, showing the source event name and the proposed new event name.
- **FR-013**: System MUST provide an "Include media files" option (unchecked by default) in the duplication dialog. When selected, media files MUST be deep-copied to new storage paths so the duplicated event's media is fully independent from the source event.
- **FR-014**: System MUST provide an "Include external links" option (checked by default) in the duplication dialog.
- **FR-015**: System MUST provide an "Include donation labels" option (checked by default) in the duplication dialog.
- **FR-016**: System MUST redirect the admin to the new event's edit page after successful duplication.
- **FR-017**: System MUST show the "Duplicate" action on both the event list page (as a row action) and the event detail/edit page.
- **FR-018**: System MUST display a success notification after duplication completes, including the new event's name.
- **FR-019**: System MUST log the duplication action in the audit trail, referencing both the source and new event.
- **FR-020**: System MUST assign the current user as the creator of the duplicated event.
- **FR-021**: System MUST associate the duplicated event with the same NPO as the source event.

### Key Entities

- **Source Event**: The existing event being duplicated. Can be in any status (DRAFT, ACTIVE, or CLOSED). Remains unchanged by the duplication process.
- **Duplicated Event**: The new event created by the duplication. Always starts in DRAFT status with no date set. Inherits configuration data from the source but has its own unique identity (ID, slug).
- **Cloned Child Records**: Independent copies of food options, ticket packages, table configurations, sponsors, and optionally media/links/donation labels. Each gets a new identity and belongs to the duplicated event. Changes to these records do not affect the source event's records.

## Clarifications

### Session 2025-03-04

- Q: When media files are included during duplication, should the system create new blob copies or share references to existing blobs? → A: Deep-copy blobs to new storage paths so the copied event has fully independent media files.
- Q: Should duplicated ticket packages keep their original active/inactive state or reset to inactive? → A: Keep ticket packages in their original active/inactive state, ready to go when the event is published.
- Q: How should the system handle potentially slow duplication when media deep-copy is selected? → A: Synchronous operation with a loading spinner; user waits until complete, then is redirected to the new event.

## Assumptions

- Auction items are NOT included in duplication because they are highly specific to each event edition (unique items, values, descriptions). Admins are expected to create or import new auction items for each event.
- Promo codes are NOT duplicated because they are tied to specific marketing campaigns and time windows.
- Sponsor logo files are shared references (same blob storage URLs) rather than duplicated files, since organizations typically reuse the same logo assets. If a sponsor's logo is later updated on the duplicated event, it changes only for that event (new upload creates a new blob). This differs from event media (images, flyers), which are deep-copied to independent storage paths when included.
- The seating layout image URL (if any) is NOT copied by default since it's an uploaded floor plan that may change between venues/years. It is included only if the admin opts to include media files (and will be deep-copied like other media).
- The "event_datetime" field is set to null on the duplicated event. The admin must provide a valid future date before the event can be published.
- The duplicated event's version counter starts at 1 (fresh optimistic locking).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can duplicate an event and land on the new event's edit page in under 5 seconds.
- **SC-002**: 100% of specified cloneable data (event details, food options, ticket packages, table configuration, sponsors) is accurately copied to the new event with no data loss or corruption.
- **SC-003**: 0% of excluded data (registrations, bids, seating assignments, auction items, promo codes, ticket purchases, donations, meal selections) appears on the duplicated event.
- **SC-004**: The duplication action is accessible from both the event list and event detail page with no more than 2 clicks from either location.
- **SC-005**: Admins setting up a recurring annual event can reduce event creation time by at least 75% compared to creating from scratch (based on the number of fields/records that don't need manual re-entry).
- **SC-006**: The optional media inclusion toggle correctly includes or excludes media files based on the admin's choice in 100% of cases.
