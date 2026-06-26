# Feature Specification: Impact Donations

**Feature Branch**: `052-impact-donations`
**Created**: 2026-06-26
**Status**: Draft
**Input**: User description: "impact-donations"

## Assumptions

- Impact Donations are the same underlying auction item record as silent auction items, with an Impact category or flag and buy-now-only behavior.
- The Admin PWA exposes Impact Donations through a dedicated tab within Auction Items.
- Impact Donations appear alongside silent auction items in donor-facing listings rather than in a separate public area.
- Each Impact Donation requires an amount and an impact statement that explains what the donation supports.
- Donation revenue from Impact Donations is counted in donation totals, not as auction-winning revenue.
- Admin users can attach still images and videos to auction items, including Impact Donations.

## Clarifications

### Session 2026-06-26

- Q: Should Impact Donations be a distinct item type or modeled as silent auction items with an Impact category/flag? → A: Model them as silent auction items with an Impact category/flag and buy-now-only behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Impact Donations (Priority: P1)

As an admin, I want to create an Impact Donation from the dedicated tab in Auction Items so that I can offer a donation option with a clear charitable outcome.

**Why this priority**: This is the core feature. Without creation and editing, Impact Donations cannot exist in the event experience.

**Independent Test**: An admin can create an item with an amount and impact statement, save it, and see it listed in the Impact Donations tab.

**Acceptance Scenarios**:

1. **Given** an event with auction items enabled, **When** an admin creates an Impact Donation with an amount and impact statement, **Then** the item is saved and shown in the Impact Donations tab.
2. **Given** an existing Impact Donation, **When** an admin edits its amount or impact statement, **Then** the updated values are saved and reflected in the Impact Donations tab.
3. **Given** an admin leaves the amount or impact statement empty, **When** they try to save the item, **Then** the item is not saved and the missing required fields are clearly indicated.

---

### User Story 2 - Donor Purchase Flow (Priority: P2)

As a donor, I want Impact Donations to appear alongside silent auction items so that I can support the event without leaving the auction experience.

**Why this priority**: This is the primary donor-facing value. It ensures Impact Donations are discoverable and purchaseable in the same place donors already browse items.

**Independent Test**: A donor can filter to the Impact category, open an Impact Donation, and complete a buy-now purchase.

**Acceptance Scenarios**:

1. **Given** an event with published silent auction items and Impact Donations, **When** a donor browses the Win It page, **Then** Impact Donations appear mixed in with the silent auction listings.
2. **Given** the Win It page filter is available, **When** the donor selects Impact, **Then** only Impact Donations are shown.
3. **Given** a donor completes a purchase for an Impact Donation, **When** the transaction is confirmed, **Then** the item is treated as a buy-now donation rather than a bid-winning auction item.

---

### User Story 3 - Item Media Enhancements (Priority: P3)

As an admin, I want to add videos to auction items so that items can be presented with richer media when needed.

**Why this priority**: Media is important for presentation quality, but it is secondary to creating and selling Impact Donations.

**Independent Test**: An admin can attach a video to an auction item, save it, and see the video included when viewing the item details.

**Acceptance Scenarios**:

1. **Given** an auction item with media enabled, **When** an admin uploads a video, **Then** the video is stored and associated with the item.
2. **Given** an auction item with both image and video media, **When** a donor opens the item, **Then** the media displays in the item experience.
3. **Given** an unsupported or invalid media file, **When** the admin attempts to upload it, **Then** the upload is rejected with a clear message.

---

### Edge Cases

- An Impact Donation with a zero or negative amount cannot be saved.
- An Impact Donation without an impact statement is treated as incomplete and cannot be published.
- Impact Donations are not shown as bid-based items and do not participate in auction ranking or bidding history.
- If multiple media files exist for an item, the item still presents consistently in donor-facing listings.
- If a video cannot be processed for display, the item remains available with its other media and core purchase action intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Admin users MUST be able to create and manage Impact Donations from a dedicated tab within Auction Items.
- **FR-002**: Impact Donations MUST be stored and managed as silent auction items with an Impact category or equivalent flag.
- **FR-003**: Impact Donations MUST require an amount and an impact statement before they can be saved or published.
- **FR-004**: Admin users MUST be able to edit the amount, impact statement, category, and media for an existing Impact Donation.
- **FR-005**: Impact Donations MUST be displayed to donors alongside silent auction items in the Win It experience.
- **FR-006**: Donors MUST be able to filter auction listings to show Impact Donations.
- **FR-007**: Impact Donations MUST be purchasable as buy-now items and MUST NOT require bidding.
- **FR-008**: Completed Impact Donation purchases MUST contribute to donation totals.
- **FR-009**: Impact Donations MUST be labeled clearly so donors can distinguish them from competitive auction items.
- **FR-010**: Admin users MUST be able to attach video media to auction items in addition to still images.
- **FR-011**: Donor-facing item views MUST present video media without removing the item's core purchase action.

### Key Entities *(include if feature involves data)*

- **Impact Donation**: A silent auction item marked with an Impact category or flag, configured for buy-now-only purchase, with an amount, an impact statement, and donor-facing display metadata.
- **Auction Item Media**: Visual media attached to an auction item, including still images and videos.
- **Donation Total**: The accumulated donation revenue reported for the event, including Impact Donation purchases.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin users can create and publish an Impact Donation in under 3 minutes for at least 90% of attempts during validation testing.
- **SC-002**: At least 95% of donor testers can find Impact Donations in the Win It experience and complete a buy-now purchase without assistance.
- **SC-003**: Impact Donations appear in the Impact filter and in the mixed silent-auction listing for 100% of published events that include them.
- **SC-004**: Event donation totals include Impact Donation purchases correctly in 100% of reporting checks.
- **SC-005**: Admin users can attach a video to an auction item and confirm it in the item view in under 2 minutes for at least 90% of attempts.
