# Feature Specification: Donor Bidding UI

**Feature Branch**: `024-donor-bidding-ui`
**Created**: 2026-02-07
**Status**: Draft
**Input**: User description: "donor-bidding-ui: I need to add a ui for the donor PWA for viewing and bidding on silent auction items. From the Gallery view they should be able to see the current bid, with a slider to bid on the item. when they slide the slider it should bring up a modal dialog where they can select how much they want to bid. i want it to be like a vertical slider that has the minimum they have to bid at the bottom of the selector then they can scroll up to increase the ammount. There should be a button for \"Place Bid\" and a button for \"Set as Max Bid\". When theybhit either  of those it should come up with a confirmation popup where they again have to slide to place the bid. When they place they place the bid it should show them a brief notification saying the bid was placed. They should also be able to open an auction item to view details, swipe through pictures and see how many bids have been placed. I also want them to be able to add items to a watch list, where those items will be placed prominantly in their gallery. I want to show a notice on the item for how many people are watching it. In the Admin PWA, i want to be able to see for each item, who is watching it, how long users have looked at that item, who has bid on it, what all the bids are, etc. I also want from the Admin PWA to be able to add a custom Notification on the item and a badge that will show on the donors auction item gallery, such as \"Hot Item\" or \"Super Deal\", to help encourage bidders. The donor should also be able to see a button to Buy Now if that option is available for the item had a limited quantity, show how many are still available, but give the admin the ability to disable this or override it in the Admin PWA."

## Clarifications

### Session 2026-02-07

- Q: Should admins see identifiable watcher/viewer and bidder details, or only aggregated stats? → A: Admins can see identifiable watcher/viewer and bidder details, limited to the event’s admin staff.
- Q: What confirmation method should be required after choosing a bid amount? → A: Confirm requires a final slide gesture.
- Q: How should the Set as Max Bid action behave when max bids are not allowed? → A: Hide Set as Max Bid when the option is unavailable.
- Q: When buy-now is unavailable, should donors still see the button, and can admins add quantity later? → A: Show the Buy Now button disabled with an explanation when unavailable, and admins can add more quantity at any point.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bid on an item from the gallery (Priority: P1)

As a donor, I can see the current bid in the gallery and use a bid slider to place a bid or set a maximum bid, with a confirmation step before submission.

**Why this priority**: Bidding is the core purpose of the silent auction experience.

**Independent Test**: Can be fully tested by placing a bid or max bid from the gallery and receiving a confirmation and success notification.

**Acceptance Scenarios**:

1. **Given** a donor is viewing the gallery and an item is open for bidding, **When** they move the bid slider, **Then** a bid modal opens with a vertical slider showing the minimum bid at the bottom and higher amounts upward.
2. **Given** the bid modal is open and the donor selects an amount, **When** they choose Place Bid or Set as Max Bid, **Then** a confirmation dialog appears requiring a final slide to confirm.
3. **Given** the donor completes the confirmation slide, **When** the bid is accepted, **Then** they see a brief confirmation notification and the current bid display updates.

---

### User Story 2 - Explore item details and manage a watch list (Priority: P2)

As a donor, I can open an item to see details, swipe through images, see bid counts, and add the item to a watch list that is prioritized in my gallery while also showing how many people are watching it.

**Why this priority**: Browsing and tracking items drives engagement and repeat bidding.

**Independent Test**: Can be fully tested by viewing item details, adding/removing a watch list entry, and confirming gallery ordering plus watch count display.

**Acceptance Scenarios**:

1. **Given** a donor opens an item, **When** they view the details, **Then** they can swipe through all item images and see the total number of bids.
2. **Given** a donor adds an item to their watch list, **When** they return to the gallery, **Then** watched items appear in a prominent section and show a watcher count badge.

---

### User Story 3 - Admin insights and promotion controls (Priority: P3)

As an admin, I can view detailed engagement and bidding activity for each item and configure promotional labels and buy-now availability that donors can see.

**Why this priority**: Admin insight and promotion controls help drive fundraising outcomes.

**Independent Test**: Can be fully tested by inspecting an item in the admin app to see watchers, viewing time, bid history, and setting a badge/notification and buy-now status.

**Acceptance Scenarios**:

1. **Given** an admin views an item, **When** they open the engagement panel, **Then** they can see who is watching, how long users viewed the item, who bid, and the full bid history.
2. **Given** an admin sets a custom badge or notification and toggles buy-now availability, **When** donors view the gallery or item details, **Then** the badge/notification and buy-now status reflect the admin settings.

---

### Edge Cases

- What happens when the auction is closed or the item is no longer accepting bids?
- How does the system handle a bid that is below the current minimum or a stale amount after another bid is placed?
- What happens when the buy-now quantity reaches zero?
- What happens when an admin adds buy-now quantity after it was previously unavailable?
- How does the system handle a user who is not signed in attempting to bid or watch an item?
- What happens when an item is removed or hidden after being watched?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The donor gallery MUST display each item’s current bid and whether bidding is open.
- **FR-002**: The bid interaction MUST provide a slider that opens a modal with a vertical selector where the minimum allowed bid is at the bottom and higher values are upward.
- **FR-003**: The bid modal MUST provide a Place Bid action and MUST only show Set as Max Bid when max bids are allowed.
- **FR-004**: A confirmation step MUST require a final slide action before a bid or max bid is submitted.
- **FR-005**: After a successful bid submission, donors MUST see a brief success notification and the displayed current bid MUST refresh.
- **FR-006**: Donors MUST be able to open an item to view details, swipe through images, and see the total number of bids.
- **FR-007**: Donors MUST be able to add or remove items from a watch list.
- **FR-008**: Watched items MUST be displayed prominently in the donor gallery and show the total number of watchers.
- **FR-009**: Admins MUST be able to view, per item, the list of watchers, time spent viewing, list of bidders, and full bid history, limited to the event’s admin staff.
- **FR-010**: Admins MUST be able to add a custom promotional label and notification message for an item, and donors MUST see these in the gallery and item details.
- **FR-011**: Items with buy-now availability MUST display a Buy Now action and remaining quantity to donors.
- **FR-012**: When buy-now is unavailable or quantity is zero, the Buy Now action MUST remain visible but disabled with an explanation.
- **FR-013**: Admins MUST be able to disable or override buy-now availability and remaining quantity display per item, including adding quantity after it was unavailable.
- **FR-014**: The system MUST prevent bids below the current minimum and present a clear, user-friendly error message.
- **FR-015**: The system MUST prevent bidding or buying when the auction or item is closed and explain why the action is unavailable.

### Key Entities *(include if feature involves data)*

- **Auction Item**: Silent auction listing with details, images, bid state, watch count, and buy-now availability.
- **Bid**: A donor’s bid amount with timestamp and bidder identity, including max-bid intent when applicable.
- **Watch List Entry**: Association between a donor and an item indicating watch status.
- **Item View**: Engagement record capturing viewing duration per donor and item.
- **Item Promotion**: Admin-defined badge or notification shown to donors for an item.
- **Buy-Now Availability**: Remaining quantity and availability overrides for immediate purchase options.

### Assumptions

- Donors must be signed in to place bids, set max bids, or manage a watch list.
- Minimum bid amounts and bidding increments are defined by the event rules and are available to the UI.
- Buy-now availability only applies to items explicitly configured with immediate purchase and a limited quantity.

### Dependencies

- Auction items, bidding rules, and item images are available to the donor gallery and item detail views.
- Admin users have access to item engagement and bidding data for management workflows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of donors can place a bid or max bid from the gallery without needing help on the first attempt.
- **SC-002**: Donors can complete the bid flow (open slider → confirm → success notification) in under 60 seconds.
- **SC-003**: At least 80% of donors who use watch list features return to a watched item at least once during the event.
- **SC-004**: Admins can retrieve watcher lists, view durations, and bid histories for an item within 10 seconds.
