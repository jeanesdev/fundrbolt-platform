# Feature Specification: Silent Auction Anti-Sniping Auto-Extension

**Feature Branch**: `051-auto-auction-extension`
**Created**: 2026-06-25
**Status**: Draft
**Input**: User description: "I want to add a feature on the silent auction items so that if the item gets a bid within the last 3 minutes it automatically extends the bid an additional 3 minutes. This is to prevent bidders from \"sniping\" and ensuring that everyone has a chance to bid on the item. This should be a global option that is on by default. I want a switch on the auction items page on the silent auction tab in the admin pwa. I want it to default to a 3 minute extension but it should be configurable to be more or less. I also want to be able to set a max extension, which should be 30 minutes by default, which means that the bid cannot be extended beyond 30 minute of the original silent auction end time."

## Clarifications

### Session 2026-06-25

- Q: Which timestamp determines whether a bid falls within the extension trigger window? → A: Use server bid acceptance time.
- Q: What is the policy scope for auto-extension settings? → A: One policy per event, initialized from system defaults.
- Q: When do event-level policy changes become active? → A: Immediately for subsequent accepted bids.
- Q: What numeric bounds should be enforced for extension configuration? → A: Extension duration 1-10 minutes; max total extension 0-60 minutes.
- Q: How should rollout handle existing events with no policy configured? → A: Auto-create event policy from system defaults.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Fair Bidding Window Protection (Priority: P1)

As a donor placing bids, I want the closing time to extend when a qualifying late bid is placed so I still have a fair chance to respond and participate.

**Why this priority**: This directly delivers the primary business goal of preventing end-of-auction sniping and protecting bidder trust.

**Independent Test**: Can be fully tested by creating a silent auction item with a known end time, placing a bid within the configured extension window, and verifying the close time increases by the configured extension amount up to the maximum allowed cap.

**Acceptance Scenarios**:

1. **Given** a silent auction item with auto-extension enabled and 3 minutes remaining, **When** a valid bid is placed at or inside the final 3 minutes, **Then** the item close time is extended by 3 minutes.
2. **Given** a silent auction item with auto-extension enabled and more than 3 minutes remaining, **When** a valid bid is placed, **Then** no extension is applied.
3. **Given** a silent auction item with auto-extension enabled and the item has already reached its maximum total extension cap, **When** a new valid bid is placed during the extension window, **Then** no additional extension is applied and the cap remains enforced.

---

### User Story 2 - Event-Level Auction Extension Configuration (Priority: P2)

As an auction administrator, I want an event-level switch and configurable extension values in the Silent Auction admin page so I can control anti-sniping behavior for all silent auction items in that event without editing each item individually.

**Why this priority**: Administrators need centralized control to apply policy consistently and adapt to event-specific bidding behavior.

**Independent Test**: Can be independently tested by changing the event-level toggle and timing values in admin settings, saving, and verifying newly qualifying bid events follow the updated policy.

**Acceptance Scenarios**:

1. **Given** system defaults are configured, **When** a new event or auction configuration is initialized, **Then** that event starts with auto-extension enabled, default extension duration of 3 minutes, and default maximum total extension of 30 minutes.
2. **Given** an admin opens the Silent Auction tab, **When** they adjust extension duration and maximum extension and save, **Then** the updated values are applied as the active event-level policy.
3. **Given** the event-level auto-extension toggle is turned OFF, **When** bids are placed in the final extension window for that event, **Then** no automatic extension occurs.
4. **Given** an admin saves policy changes while bidding is ongoing, **When** the next valid bid is accepted, **Then** the new policy is used and prior accepted bids are not retroactively recalculated.
5. **Given** an existing event without a stored extension policy, **When** that event is first evaluated after rollout, **Then** an event-level policy is auto-created from system defaults and used for subsequent qualifying bids.

---

### User Story 3 - Transparent Closing-Time Behavior (Priority: P3)

As an event operator, I want predictable and visible extension behavior so support staff and bidders can understand why item close times changed and when they can no longer be extended.

**Why this priority**: Operational clarity reduces disputes, confusion, and manual intervention during live auctions.

**Independent Test**: Can be independently tested by simulating repeated near-close bids and confirming the displayed and stored close time changes are consistent with policy and stop at the configured maximum cap.

**Acceptance Scenarios**:

1. **Given** repeated valid bids are placed during qualifying windows, **When** each bid is accepted, **Then** the close time updates according to policy and never exceeds the original close time plus the configured maximum total extension.
2. **Given** administrators and bidders view an item after one or more extensions, **When** they check the item timing, **Then** they see the current effective closing time that reflects applied extensions.

---

### Edge Cases

- A bid arrives exactly at the extension-window boundary (for example, exactly 3:00 remaining): based on server bid acceptance time, it is treated consistently as a qualifying late bid.
- Multiple bids are accepted nearly simultaneously in the final seconds: extensions are calculated from the latest effective close time while still respecting the maximum total extension cap.
- The configured extension duration is greater than the remaining extension cap: only the remaining allowable extension is applied.
- Auto-extension is disabled after previous extensions have occurred: no further automatic extensions are applied, and the current close time remains unchanged.
- Maximum extension is configured to zero: the feature behaves as effectively disabled even if the event-level switch remains ON.
- Bid arrives after the item is already closed: no extension is applied and the bid is rejected according to normal closed-item rules.
- Admin enters an out-of-range value: save is rejected with a clear validation error and prior valid policy remains unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an event-level silent-auction auto-extension policy.
- **FR-002**: The system MUST default the extension trigger window to 3 minutes before an item's scheduled close time.
- **FR-003**: The system MUST default the extension duration to 3 minutes per qualifying bid.
- **FR-004**: The system MUST default the maximum total extension to 30 minutes beyond the original scheduled close time.
- **FR-005**: The system MUST allow authorized administrators to enable or disable event-level auto-extension from the Silent Auction section of the auction items admin page.
- **FR-006**: The system MUST allow authorized administrators to configure extension duration and maximum total extension values.
- **FR-006a**: The system MUST accept extension duration values only in the range 1-10 minutes.
- **FR-006b**: The system MUST accept maximum total extension values only in the range 0-60 minutes.
- **FR-007**: When auto-extension is enabled, the system MUST extend the item close time when a valid bid is accepted at or within the configured trigger window.
- **FR-008**: The system MUST ensure total extension time for an item never exceeds the configured maximum total extension beyond that item's original scheduled close time.
- **FR-009**: The system MUST not apply auto-extension to bids accepted outside the configured trigger window.
- **FR-010**: The system MUST apply auto-extension policy consistently for all silent auction items in the event covered by that event-level policy.
- **FR-011**: The system MUST persist configuration changes so they remain active for subsequent qualifying bids until changed again by an authorized administrator.
- **FR-012**: The system MUST expose the current effective closing time for each silent auction item after any applied extension so users and administrators can see the active close deadline.
- **FR-013**: The system MUST evaluate extension-window eligibility using server bid acceptance time.
- **FR-014**: The system MUST initialize each new event-level policy from system defaults: enabled status ON, 3-minute extension duration, and 30-minute maximum total extension.
- **FR-015**: The system MUST apply saved event-level policy changes immediately to subsequent accepted bids and MUST NOT retroactively recalculate previously accepted bids or previously applied extensions.
- **FR-016**: The system MUST reject out-of-range configuration submissions with a clear validation message and MUST preserve the last valid saved policy.
- **FR-017**: For existing events that do not yet have an event-level policy at rollout, the system MUST auto-create that policy using system defaults before extension evaluation.

### Key Entities *(include if feature involves data)*

- **Silent Auction Extension Policy**: Event-level configuration defining whether auto-extension is enabled, the trigger window duration, per-bid extension duration, and maximum total extension allowed from original close time, initialized from system defaults.
- **Silent Auction Item Timing**: Time state for an auction item, including original scheduled close time, current effective close time, and cumulative extension applied.
- **Bid Event**: A valid accepted bid with timestamp and target item used to determine whether extension rules should be triggered.

### Assumptions

- The event-level policy applies uniformly to all silent auction items in that event and does not require per-item overrides in this feature.
- Only valid accepted bids (not rejected or invalid bids) can trigger auto-extension.
- Administrators changing policy values understand that updated settings apply prospectively to subsequent qualifying bids.
- Existing bidding eligibility, authentication, and authorization rules remain unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of qualifying bids placed at or within the configured trigger window extend the item close time according to policy, capped by the configured maximum total extension.
- **SC-002**: 100% of non-qualifying bids placed outside the trigger window do not change the item close time.
- **SC-003**: 100% of auto-extension configurations created with defaults start with enabled status, 3-minute extension duration, and 30-minute maximum total extension.
- **SC-004**: During monitored auctions, bidder complaints or support escalations specifically tied to end-of-auction sniping decrease by at least 50% compared with a comparable pre-feature baseline period.
- **SC-005**: In post-event admin feedback, at least 90% of surveyed operators report that auction close-time behavior was clear and predictable.
