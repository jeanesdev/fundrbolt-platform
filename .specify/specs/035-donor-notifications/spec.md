# Feature Specification: Donor Notifications

**Feature Branch**: `035-donor-notifications`
**Created**: 2026-03-12
**Status**: Draft
**Input**: User description: "Add notifications to donors through the donor PWA. Configurable notifications for silent auction open, outbid, admin-placed bids (paddle raise), auction closing soon, checkout reminder, push notifications on iOS/Android, in-app notification center with badge, animations (confetti, flash), admin custom notifications, spoof user support, SMS/email opt-in."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — In-App Notification Center (Priority: P1)

Donors see a persistent notification bell icon on all event pages (Home, Auction, and Seat tabs). The icon displays a badge showing the count of unread notifications. Tapping it opens a notification center panel that lists all notifications for the current event in reverse chronological order. Each notification shows a brief message, timestamp, and an unread indicator. Donors can mark individual notifications as read, mark all as read, or tap a notification to navigate to the relevant content (e.g., an auction item they were outbid on). Notifications are scoped to the currently viewed event.

**Why this priority**: The notification center is the foundational UI surface that all other notification types depend on. Without it, there is no way to display or manage notifications.

**Independent Test**: Can be fully tested by manually creating test notifications and verifying the bell icon appears on all event tabs, the badge count updates, the panel opens/closes, and tapping a notification navigates to the correct destination.

**Acceptance Scenarios**:

1. **Given** a donor is viewing any event page (Home, Auction, or Seat tab), **When** the page loads, **Then** a notification bell icon is visible in the header area and persists across tab changes.
2. **Given** a donor has 3 unread notifications, **When** they view the bell icon, **Then** a badge displays "3". When the count exceeds 9, the badge displays "9+".
3. **Given** a donor taps the bell icon, **When** the notification center opens, **Then** notifications are listed newest-first with message text, relative timestamp (e.g., "2 min ago"), and an unread dot indicator.
4. **Given** a donor taps a notification about being outbid on an item, **When** the notification center processes the tap, **Then** the donor is navigated to that auction item's detail view and the notification is marked as read.
5. **Given** a donor taps "Mark all as read", **When** the action completes, **Then** all notifications for the current event are marked as read and the badge count resets to zero.
6. **Given** a donor has no notifications, **When** they open the notification center, **Then** they see a friendly empty state (e.g., "No notifications yet — you're all caught up!").

---

### User Story 2 — Outbid Notification (Priority: P1)

When another bidder places a higher bid on an auction item that a donor was previously winning, the donor receives an immediate notification. The notification appears in the notification center and, if the app is in the foreground, an in-app toast/banner animates into view with a brief flash effect to create urgency. The notification includes the item name, new highest bid amount, and a direct link to place a new bid.

**Why this priority**: Outbid notifications are the single most revenue-impactful notification. They re-engage donors in real time and drive competitive bidding, directly increasing auction proceeds.

**Independent Test**: Can be tested by having two test donors bid on the same item and verifying the outbid donor receives a notification with correct item details, amount, and deep link.

**Acceptance Scenarios**:

1. **Given** Donor A is the current high bidder on "Signed Baseball", **When** Donor B places a higher bid, **Then** Donor A receives a notification: "You've been outbid on Signed Baseball! New high bid: $150. Tap to bid again."
2. **Given** the donor PWA is in the foreground when an outbid event occurs, **When** the notification arrives, **Then** an in-app toast/banner slides in with a brief amber flash animation to draw attention.
3. **Given** the donor PWA is in the background or the device is locked, **When** an outbid event occurs and the donor has opted into push notifications, **Then** a native push notification appears on the device.
4. **Given** a donor is outbid on multiple items in quick succession, **When** notifications arrive, **Then** each outbid notification is delivered individually (not grouped) so no outbid alert is missed.
5. **Given** Donor A taps the outbid notification, **When** the app opens, **Then** the donor is taken directly to the auction item detail view with the bid input ready.

---

### User Story 3 — Auction Lifecycle Notifications (Priority: P1)

Donors receive notifications at key auction milestones: when the silent auction opens, when the auction is approaching its close (configurable warning window, e.g., 15 minutes, 5 minutes, 1 minute before closing), and when the auction closes and winners are determined. Winning notifications include a celebratory confetti animation. These notifications keep donors engaged throughout the event and reduce missed bidding opportunities.

**Why this priority**: Auction lifecycle events drive the core fundraising flow. Missing the auction opening or closing directly reduces participation and revenue.

**Independent Test**: Can be tested by configuring an auction with a known open/close time, advancing to those times, and verifying notifications are sent at each milestone with correct messaging and animations.

**Acceptance Scenarios**:

1. **Given** a silent auction is configured to open at 7:00 PM, **When** the auction opens, **Then** all registered donors for that event receive a notification: "The silent auction is now open! Browse [X] items and start bidding."
2. **Given** a silent auction is configured to close at 9:00 PM with warning intervals at 15, 5, and 1 minute, **When** each warning threshold is reached, **Then** all donors who have placed at least one bid OR have items on their watchlist receive a closing-soon notification: "Silent auction closes in [X] minutes! You have [N] active bids."
3. **Given** the silent auction has closed and Donor A has won 2 items, **When** the results are finalized, **Then** Donor A receives a winning notification with a confetti animation: "Congratulations! You won 2 items: [Item 1] and [Item 2]. Head to checkout to complete your purchase!"
4. **Given** the silent auction has closed and Donor B did not win any items, **When** results are finalized, **Then** Donor B receives a gracious notification: "The auction has ended. Thank you for participating! Your bids helped drive the fundraiser."
5. **Given** an event coordinator changes the auction closing time while the auction is live, **When** the time changes, **Then** previously scheduled closing-soon notifications are adjusted to the new closing time.

---

### User Story 4 — Push Notifications (Priority: P1)

Donors who have installed the PWA on their device (iOS or Android) can opt in to receive native push notifications. When the donor is not actively using the app, critical notifications (outbid, auction open/close, winning items, checkout reminder) appear as native device notifications with the Fundrbolt icon and are tappable to open the relevant page in the app. The opt-in prompt appears at an appropriate moment (e.g., after first bid or event check-in) rather than immediately on page load.

**Why this priority**: Push notifications are the primary mechanism to re-engage donors who have navigated away from the app. Without push, time-sensitive notifications (outbid, closing soon) lose most of their value.

**Independent Test**: Can be tested by installing the PWA on a test device, opting into push notifications, sending a test notification, and verifying it appears as a native device notification that opens the correct page when tapped.

**Acceptance Scenarios**:

1. **Given** a donor has installed the PWA and has not yet opted into push notifications, **When** the donor places their first bid or checks in to an event, **Then** a non-intrusive prompt appears asking if they'd like to receive push notifications, with clear language about what they'll receive.
2. **Given** a donor accepts push notifications, **When** they are subsequently outbid while the app is closed, **Then** a native push notification appears on their device with the Fundrbolt app icon, item name, and new bid amount.
3. **Given** a donor taps a push notification about being outbid, **When** the app opens, **Then** they are taken directly to the auction item they were outbid on.
4. **Given** a donor declines push notifications, **When** time-sensitive events occur, **Then** no native notifications are sent but in-app notifications still accumulate in the notification center for when the donor returns.
5. **Given** a donor is using an iOS device with the PWA installed, **When** push notifications are sent, **Then** they appear correctly using the platform's notification system (respecting iOS PWA push notification requirements).
6. **Given** a donor has push notifications enabled and is actively using the app in the foreground, **When** a notification event occurs, **Then** the system does NOT send a duplicate push notification — only the in-app toast is shown.

---

### User Story 5 — Admin-Placed Bid Notification / Paddle Raise (Priority: P2)

When an event administrator submits a bid on behalf of a donor (such as during a live paddle raise), the donor receives a notification confirming the bid was placed on their behalf. This keeps donors informed about commitments made in their name and provides transparency. The notification includes the item or donation label, the amount, and who placed it.

**Why this priority**: Paddle raise and admin-placed bids are critical for live fundraising events. Donors must be promptly informed when financial commitments are made on their behalf to maintain trust and enable them to dispute errors.

**Independent Test**: Can be tested by having an admin place a bid on behalf of a specific donor and verifying the donor receives a notification with accurate details.

**Acceptance Scenarios**:

1. **Given** an admin places a $500 bid on "Vacation Package" on behalf of Donor A, **When** the bid is submitted, **Then** Donor A receives a notification: "A bid of $500 was placed on your behalf for Vacation Package by [Admin Name]."
2. **Given** an admin records a $1,000 paddle raise donation for Donor A, **When** the donation is recorded, **Then** Donor A receives a notification: "A $1,000 donation was recorded on your behalf by [Admin Name]. Thank you for your generosity!"
3. **Given** the donor is not currently using the app, **When** an admin-placed bid notification is sent, **Then** a push notification is delivered (if opted in) with sufficient context to understand the action taken.

---

### User Story 6 — Checkout Reminder (Priority: P2)

At the end of an event, donors who have outstanding balances (auction wins, donations, unpaid tickets) receive a reminder notification to complete their checkout. The reminder is triggered at a configurable time (e.g., when the event coordinator marks the event as "wrapping up" or at a scheduled time). A follow-up reminder is sent if the donor has not checked out within a configurable interval.

**Why this priority**: Checkout reminders directly impact revenue collection. Donors who leave without paying represent lost revenue and additional administrative burden for follow-up.

**Independent Test**: Can be tested by creating a donor with outstanding auction wins and triggering the checkout flow, then verifying reminder notifications are sent at the configured times.

**Acceptance Scenarios**:

1. **Given** the event coordinator triggers the checkout phase, **When** Donor A has 3 won items totaling $750, **Then** Donor A receives a notification: "Time to check out! You have 3 items totaling $750 awaiting payment. Tap to complete checkout."
2. **Given** Donor A received a checkout reminder 15 minutes ago and has not completed checkout, **When** the follow-up interval elapses, **Then** a second reminder is sent: "Don't forget! Your checkout of $750 is still pending."
3. **Given** a donor completes checkout, **When** payment is confirmed, **Then** no further checkout reminders are sent and the donor receives a thank-you notification.
4. **Given** a donor has no outstanding balance, **When** the checkout phase begins, **Then** no checkout reminder is sent to that donor.

---

### User Story 7 — Admin Custom Notifications (Priority: P2)

Event administrators can compose and send custom notifications to specific donors or groups of donors from the admin PWA. The admin can write a custom message, select recipients (individual donors, all attendees, all bidders, donors at a specific table, etc.), choose delivery channels (in-app, push, email, SMS), and preview the notification before sending. This enables real-time event communication such as "Dinner is served!", "Please return to your seats", or personalized messages.

**Why this priority**: Custom notifications give event coordinators a powerful communication tool for real-time event management and donor engagement beyond the automated notification types.

**Independent Test**: Can be tested by composing a custom notification in the admin PWA, selecting specific donors as recipients, and verifying those donors receive the notification through the chosen channels.

**Acceptance Scenarios**:

1. **Given** an admin navigates to the notification management section, **When** they compose a new notification, **Then** they can enter a message (up to 500 characters), select recipients, choose channels, and preview before sending.
2. **Given** an admin selects "All attendees" as recipients and "In-app + Push" as channels, **When** they send the notification, **Then** all checked-in donors receive the notification in-app and via push (if opted in).
3. **Given** an admin selects 3 specific donors and sends a custom notification, **When** the notification is delivered, **Then** only those 3 donors receive it.
4. **Given** an admin sends a custom notification, **When** the notification is delivered, **Then** a record is stored showing the sender, message, recipients, channels used, and delivery timestamp.
5. **Given** an admin wants to notify all donors at Table 5, **When** they select "Table 5" from the recipient filter, **Then** only donors assigned to Table 5 receive the notification.

---

### User Story 8 — Notification Preferences & Channel Opt-In (Priority: P2)

Donors can manage their notification preferences from a settings page. They can opt in or out of each notification channel (in-app, push, email, SMS) and configure which types of notifications they want to receive on each channel. In-app notifications are always enabled (the notification center always shows notifications). Email and SMS require the donor to have a verified email or phone number on file, respectively. Preferences are per-donor (not per-event) and persist across events.

**Why this priority**: Respecting donor communication preferences is essential for trust, legal compliance (CAN-SPAM, TCPA), and user satisfaction. Allowing channel selection increases engagement by letting donors choose their preferred medium.

**Independent Test**: Can be tested by toggling notification preferences on and off and verifying that notifications are only delivered through the channels the donor has enabled.

**Acceptance Scenarios**:

1. **Given** a donor navigates to notification settings, **When** the settings page loads, **Then** they see toggles for each channel (Push, Email, SMS) and each notification type (Outbid, Auction Updates, Checkout Reminders, Admin Messages).
2. **Given** a donor enables email notifications for outbid alerts, **When** they are outbid on an item, **Then** they receive both an in-app notification AND an email notification.
3. **Given** a donor disables push notifications for auction updates, **When** the auction opens, **Then** they receive an in-app notification but NOT a push notification.
4. **Given** a donor attempts to enable SMS notifications but has no phone number on file, **When** they toggle SMS on, **Then** they are prompted to add and verify their phone number first.
5. **Given** a donor's preferences are set, **When** they attend a different event in the future, **Then** the same preferences apply without needing reconfiguration.

---

### User Story 9 — In-App Notification Animations (Priority: P3)

Notifications displayed within the app include contextual animations that enhance the emotional experience and draw attention. When a donor wins an auction item, the notification triggers a confetti burst animation. When a donor is outbid, an amber/orange flash effect pulses on the notification toast. When a new bid is confirmed, a subtle success animation plays. These animations are brief (1–3 seconds), non-blocking, and respect reduced-motion accessibility preferences.

**Why this priority**: Animations transform notifications from informational to experiential, making the fundraising event feel exciting and celebratory. However, the feature is fully functional without animations.

**Independent Test**: Can be tested by triggering each notification type and visually verifying the corresponding animation plays, then enabling "prefers-reduced-motion" in device settings and verifying animations are suppressed.

**Acceptance Scenarios**:

1. **Given** a donor wins an auction item, **When** the winning notification appears in-app, **Then** a confetti burst animation plays for approximately 2 seconds overlaying the notification area.
2. **Given** a donor is outbid, **When** the outbid toast appears, **Then** an amber flash/pulse effect plays on the toast for approximately 1 second.
3. **Given** a donor's device has "prefers-reduced-motion" enabled, **When** any notification with animation arrives, **Then** the animation is suppressed and the notification displays without motion effects.
4. **Given** multiple animated notifications arrive in quick succession, **When** they display, **Then** only the most recent animation plays (animations do not stack or overlap chaotically).

---

### User Story 10 — Spoof User Notification Experience (Priority: P3)

When a super admin is logged into the donor PWA and has selected a spoofed user, the notification experience reflects the spoofed user's perspective. The notification center shows notifications belonging to the spoofed donor, not the admin. Push notifications are NOT sent to the admin's device for spoofed user events. This allows admins to test and debug the notification experience as if they were a specific donor.

**Why this priority**: Essential for QA and debugging but does not affect the end-user experience. Aligns with the existing spoof user pattern in the donor PWA.

**Independent Test**: Can be tested by logging in as a super admin, selecting a spoofed user, triggering a notification for that spoofed user, and verifying the notification appears in the admin's notification center under the spoofed user's context.

**Acceptance Scenarios**:

1. **Given** a super admin has spoofed Donor A, **When** they open the notification center, **Then** they see Donor A's notifications, not their own.
2. **Given** a super admin has spoofed Donor A, **When** Donor A is outbid on an item, **Then** the outbid notification appears in the admin's in-app notification center (because they are viewing as Donor A).
3. **Given** a super admin has spoofed Donor A, **When** a notification would trigger a push notification for Donor A, **Then** no push notification is sent to the admin's device — only in-app notifications are shown.
4. **Given** a super admin clears the spoofed user, **When** they return to their own identity, **Then** the notification center switches back to showing the admin's own notifications (if any).

---

### User Story 11 — Event Check-In Welcome Notification (Priority: P3)

When a donor checks into an event (either self-check-in or staff-assisted), they receive a welcome notification that orients them to the event. The notification includes a brief welcome message, the event schedule highlights (e.g., "Silent auction opens at 7 PM"), their table assignment, and a prompt to enable push notifications if not already enabled.

**Why this priority**: Provides a warm first touchpoint and helps donors navigate the event. Also serves as a natural moment to prompt for push notification opt-in.

**Independent Test**: Can be tested by checking a donor into an event and verifying the welcome notification appears with correct event details and table assignment.

**Acceptance Scenarios**:

1. **Given** Donor A is checked into "Spring Gala" at Table 5, **When** check-in completes, **Then** Donor A receives a notification: "Welcome to Spring Gala! You're seated at Table 5. The silent auction opens at 7:00 PM. Enjoy the evening!"
2. **Given** a donor has not yet enabled push notifications, **When** the welcome notification appears, **Then** it includes a call-to-action to enable push notifications.
3. **Given** a donor has already enabled push notifications, **When** the welcome notification appears, **Then** it does not include the push notification prompt.

---

### User Story 12 — Notification Delivery via Email and SMS (Priority: P3)

For donors who have opted in, certain notification types are also delivered via email and/or SMS. Email notifications are branded with the Fundrbolt design and include actionable links. SMS notifications are concise (under 160 characters) and include a short link to the relevant page. Only high-value notifications are sent via email/SMS to avoid fatigue: outbid alerts, winning confirmations, checkout reminders, and admin custom messages. Auction open/close notifications are available via email/SMS but default to off.

**Why this priority**: Email and SMS extend reach to donors who may not have the PWA installed or who prefer traditional channels. However, the primary notification path (in-app + push) delivers the core value without email/SMS.

**Independent Test**: Can be tested by opting a donor into email and SMS notifications, triggering an outbid event, and verifying both an email and SMS are received with correct content and links.

**Acceptance Scenarios**:

1. **Given** a donor has opted into email notifications for outbid alerts, **When** they are outbid, **Then** they receive a branded email with the item name, new bid amount, and a link to bid again.
2. **Given** a donor has opted into SMS notifications, **When** they are outbid, **Then** they receive an SMS: "You've been outbid on [Item]! New bid: $[Amount]. Bid again: [link]" (under 160 characters).
3. **Given** a donor has opted into both email and SMS, **When** they are outbid, **Then** both channels deliver the notification (not deduplicated across channels).
4. **Given** an SMS notification is sent, **When** the message is composed, **Then** it is under 160 characters including the link.
5. **Given** a donor has not verified their phone number, **When** an SMS notification would be sent, **Then** the SMS is skipped and only other enabled channels are used.

---

### User Story 13 — Bid Confirmation Notification (Priority: P3)

When a donor places a bid (either directly or via proxy bidding), they receive a brief confirmation notification in the notification center. If the bid makes them the new high bidder, the confirmation is celebratory. If the bid was via proxy bidding and was automatically placed, the notification clarifies that a proxy bid was executed on their behalf. This provides reassurance and a paper trail of bidding activity.

**Why this priority**: Bid confirmations provide peace of mind and a history of actions but are supplementary to the more impactful outbid and winning notifications.

**Independent Test**: Can be tested by placing a bid and verifying a confirmation notification appears in the notification center with correct bid details.

**Acceptance Scenarios**:

1. **Given** Donor A places a $200 bid on "Vacation Package" and becomes the high bidder, **When** the bid is confirmed, **Then** a notification appears: "You're the high bidder on Vacation Package at $200!"
2. **Given** Donor A's proxy bid is automatically triggered because another donor bid $180 (below Donor A's max of $250), **When** the auto-bid executes, **Then** Donor A receives: "Your proxy bid was triggered on Vacation Package. You're now the high bidder at $185."
3. **Given** Donor A places a bid but is immediately outbid by a proxy bid, **When** both events occur, **Then** Donor A receives both a bid confirmation AND an outbid notification in that order.

---

### User Story 14 — Real-Time Notification Delivery (Priority: P2)

Notifications are delivered to the donor PWA in near real-time (within a few seconds) without requiring the donor to manually refresh the page. When a notification-triggering event occurs on the backend, the donor's open app session receives the notification promptly. The notification count badge updates automatically, and in-app toasts appear without user action.

**Why this priority**: The value of time-sensitive notifications (outbid, auction closing) is directly proportional to delivery speed. A notification that arrives 30 seconds late on an outbid could mean the donor loses the item.

**Independent Test**: Can be tested by triggering a notification event while observing the donor PWA in real-time, and measuring the time between the triggering event and the notification appearing in the app.

**Acceptance Scenarios**:

1. **Given** the donor PWA is open and connected, **When** an outbid event occurs, **Then** the notification appears in the app within 5 seconds.
2. **Given** the donor's device temporarily loses network connectivity, **When** connectivity is restored, **Then** any missed notifications are delivered and the badge count updates.
3. **Given** a donor has the PWA open on two devices, **When** a notification arrives, **Then** both devices show the notification. Marking as read on one device syncs to the other within the next data refresh.

---

### Edge Cases

- What happens when a donor receives a notification for an event they are no longer registered for? → Notification is not delivered; stale registrations are filtered.
- How does the system handle notification delivery when the backend is temporarily unavailable? → Notifications are queued and delivered when the backend recovers. Push notifications use the platform's built-in retry mechanism.
- What happens if a donor revokes push notification permission at the OS level? → The system gracefully handles failed push deliveries and marks the subscription as inactive. In-app notifications continue to work.
- What happens when an auction item is deleted or withdrawn after an outbid notification was sent? → The notification persists in the notification center but the deep link shows a "This item is no longer available" message rather than an error.
- How are notifications handled for proxy bid wars (rapid automatic bid escalations)? → Intermediate proxy bid outbid notifications are batched or deduplicated so the donor doesn't receive dozens of notifications in seconds. Only the final outbid status is notified after a brief settling period (e.g., 5 seconds).
- What happens if an admin sends a custom notification with an empty recipient list? → The system prevents sending and shows a validation error.
- How does the system handle notification delivery across time zones? → All notification times are relative to the event's configured time zone.
- What happens when a donor uninstalls and reinstalls the PWA? → Push subscription is re-established on reinstall. Historical notifications are still available in the notification center (server-side storage).
- How are notifications handled for donors who have the app open on multiple tabs? → In-app toasts are shown on the active tab only; the notification center data syncs across tabs on next fetch.

## Clarifications

### Session 2026-03-12

- Q: How long should notifications persist in the notification center before being automatically cleaned up? → A: Retain for the event duration + 30 days after the event ends, then automatically purge.
- Q: What are the default opt-in states for push, email, and SMS notification channels for new donors? → A: Push: prompted contextually (after first bid or check-in). Email: on by default. SMS: off by default (explicit opt-in required for TCPA compliance).
- Q: Should in-app and/or push notifications produce sound or vibration? → A: Push notifications use the device's default notification sound/vibration. In-app toasts are silent with subtle vibration on critical alerts (outbid, winning) only.
- Q: Which admin roles should be allowed to send custom notifications to donors? → A: All admin roles (Super Admin, NPO Admin, Event Coordinator, Staff, Check-in Staff) can compose and send custom notifications.
- Q: Should push notification previews on the device lock screen show full content or hide details? → A: Show full content on lock screen (amounts, item names, etc.) for fastest donor response.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a notification center accessible via a persistent bell icon on all event pages (Home, Auction, Seat tabs) in the donor PWA.
- **FR-002**: System MUST display an unread notification count badge on the bell icon, showing the exact count up to 9 and "9+" for higher counts.
- **FR-003**: System MUST deliver outbid notifications to donors within 5 seconds of the outbid event occurring, when the donor's app is open and connected.
- **FR-004**: System MUST support native push notifications on both iOS and Android devices when the PWA is installed and the donor has opted in. Push notification previews MUST display full content (item names, amounts, actions) on the device lock screen for fastest donor response.
- **FR-005**: System MUST send auction lifecycle notifications: auction opened, closing soon (configurable warning intervals), auction closed (with win/loss results).
- **FR-006**: System MUST notify donors when an administrator places a bid or records a donation on their behalf, including the admin's name, item/label, and amount.
- **FR-007**: System MUST send checkout reminder notifications to donors with outstanding balances, with configurable timing and follow-up intervals.
- **FR-008**: System MUST provide an admin interface to compose and send custom notifications to individual donors, groups, or all event attendees. All admin roles (Super Admin, NPO Admin, Event Coordinator, Staff, Check-in Staff) MUST have permission to send custom notifications.
- **FR-009**: System MUST allow donors to configure notification preferences per channel (push, email, SMS) and per notification type from a settings page.
- **FR-010**: In-app notifications are always enabled and cannot be disabled — the notification center always accumulates notifications regardless of other channel preferences.
- **FR-011**: System MUST play contextual animations on in-app notifications: confetti for winning, amber flash for outbid. Animations MUST respect the "prefers-reduced-motion" accessibility setting. Push notifications MUST use the device's default notification sound and vibration. In-app toasts MUST be silent by default, with subtle vibration on critical alerts (outbid, winning) only.
- **FR-012**: System MUST deliver the spoofed user's notifications (not the admin's) when a super admin has selected a spoofed user in the donor PWA.
- **FR-013**: System MUST NOT send push notifications to the admin's device when viewing as a spoofed user.
- **FR-014**: System MUST queue notifications for offline donors and deliver them when the donor reconnects.
- **FR-015**: System MUST support email notification delivery using branded templates with actionable links for opted-in donors.
- **FR-016**: System MUST support SMS notification delivery with messages under 160 characters including links for opted-in donors with verified phone numbers.
- **FR-017**: System MUST deduplicate rapid-fire proxy bid notifications by applying a brief settling period before sending the final outbid notification.
- **FR-018**: System MUST send a welcome notification upon event check-in that includes event highlights and table assignment.
- **FR-019**: System MUST send bid confirmation notifications for both direct bids and automatically triggered proxy bids.
- **FR-020**: System MUST prompt donors for push notification opt-in at a contextually appropriate moment (e.g., after first bid or check-in) rather than on initial page load.
- **FR-021**: System MUST record all notifications sent, including sender, recipients, channels, content, and delivery status, for audit and troubleshooting.
- **FR-022**: System MUST allow admins to select notification recipients by individual donor, all attendees, all bidders, or by table assignment.
- **FR-023**: System MUST adjust scheduled notifications (e.g., closing-soon warnings) when the event coordinator changes the auction closing time.
- **FR-024**: System MUST handle graceful degradation when push delivery fails (e.g., expired subscription, revoked permissions) by marking the subscription as inactive and continuing in-app delivery.
- **FR-025**: System MUST deliver notifications scoped to the specific event — donors only see notifications for the event they are currently viewing in the notification center.

### Key Entities

- **Notification**: A single notification instance with content, type, priority, target donor, associated event, associated entity (e.g., auction item), delivery status per channel, read/unread state, and creation timestamp. Notifications are retained for the event duration plus 30 days after the event ends, then automatically purged.
- **Notification Type**: Categorization of notification (outbid, auction_opened, auction_closing_soon, auction_closed, winning_item, admin_bid_placed, checkout_reminder, bid_confirmation, welcome, custom_admin_message). Controls default channel routing and animation behavior.
- **Notification Preference**: A donor's per-channel, per-type opt-in/opt-out settings. Stored per donor (not per event). In-app channel is always enabled. Default states for new donors: Push — not enabled until contextual prompt is accepted (after first bid or check-in); Email — on by default; SMS — off by default (explicit opt-in required for TCPA compliance).
- **Push Subscription**: A record of a donor's device push notification subscription, including the platform (iOS/Android/desktop), subscription credentials, active/inactive status, and creation date. A donor may have multiple subscriptions across devices.
- **Notification Template**: Configurable message templates for each notification type, supporting variable interpolation (donor name, item name, amount, event name, etc.).
- **Notification Campaign**: An admin-initiated custom notification, including the composed message, selected recipient criteria, chosen channels, sender identity, and delivery report.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Donors with the PWA open receive outbid notifications within 5 seconds of the triggering event, at least 95% of the time under normal load.
- **SC-002**: At least 60% of donors who install the PWA opt in to push notifications when prompted at a contextually appropriate moment.
- **SC-003**: Checkout reminders result in at least 80% of donors with outstanding balances completing checkout within 30 minutes of the first reminder.
- **SC-004**: Donors can access the notification center, read notifications, and navigate to linked content in under 3 taps from any event page.
- **SC-005**: All notification animations complete within 3 seconds and are suppressed when the donor's device has reduced-motion preferences enabled.
- **SC-006**: Admin-composed custom notifications are delivered to all selected recipients within 30 seconds of the admin clicking send.
- **SC-007**: The notification system supports at least 500 concurrent donors per event receiving real-time notifications without degradation.
- **SC-008**: 100% of admin-placed bids and paddle raise donations result in a notification delivered to the affected donor.
- **SC-009**: Email and SMS notifications for opted-in donors are delivered within 60 seconds of the triggering event.
- **SC-010**: The notification center loads and displays the 50 most recent notifications within 2 seconds on a typical mobile connection.

## Additional Recommendations

The following recommendations go beyond the explicitly requested features to enhance the donor experience:

### Engagement & Fun
- **Donation Thank-You Notification**: When a donor makes a direct donation (not auction), send a warm thank-you notification with a running total of their contributions at the event.
- **Leaderboard Milestone Notifications**: "You're now in the top 5 donors at this event!" — gamification that drives competitive giving.
- **Watchlist Price Alerts**: If a watched item's bid crosses a threshold the donor has set, notify them before they're priced out.

### Informational & Practical
- **Table Captain Notifications**: If a donor is designated as a table captain, notify them with their responsibilities and who is seated at their table.
- **Event Schedule Notifications**: Time-based notifications for event agenda items (e.g., "Live auction starts in 10 minutes!").
- **Payment Confirmation**: After checkout, send a receipt notification with a link to view/download their receipt.

### Administrative & Operational
- **Notification Analytics Dashboard**: In the admin PWA, show delivery rates, open rates, click-through rates on notifications to help coordinators optimize communication.
- **Scheduled Custom Notifications**: Allow admins to schedule notifications for a future time (e.g., pre-compose a "Dinner is served!" notification to auto-send at 7:30 PM).
- **Notification Templates for Admins**: Pre-built templates for common event messages that admins can customize, reducing composition time during a busy event.

## Assumptions

- The existing PWA service worker infrastructure (vite-plugin-pwa, Workbox) provides a sufficient foundation for push notification support.
- iOS Safari supports Web Push API for installed PWAs (available since iOS 16.4+), and the majority of donor devices will be on a compatible OS version.
- The existing Azure Communication Services integration can be extended for SMS delivery (or a dedicated SMS provider will be integrated).
- The existing email service can be extended to support notification-triggered transactional emails.
- Real-time delivery will use a server-initiated push mechanism (rather than client polling) for time-sensitive notifications like outbid alerts.
- Notification storage is server-side to enable cross-device access and historical retrieval.
- The existing event time zone configuration is used for all time-based notification scheduling.
- Rate limiting will be applied to prevent notification abuse (e.g., max custom notifications per event per hour).
- Notification content is plain text with optional structured data (amounts, item names) — rich media (images, videos) in notifications is out of scope for the initial release.
- The spoof user mechanism will be extended to the backend so notification queries can be scoped to the spoofed user's data.
