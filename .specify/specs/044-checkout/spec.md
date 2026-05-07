# Feature Specification: Donor Event Checkout

**Feature Branch**: `044-checkout`
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "checkout — end-of-night checkout page for donors to review committed charges, approve payment, tip, and receive a receipt; admin controls for opening checkout, managing items, and monitoring progress"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Donor Completes Checkout (Priority: P1)

At the close of a fundraising event, a donor uses the Checkout page in the Donor PWA to review all items they have committed to pay for — including auction wins and other purchases — optionally add a tip, select a payment method, and confirm payment with a double-swipe gesture. The donor receives an email with a PDF receipt and can download it directly from the app.

**Why this priority**: This is the core end-to-end checkout experience. Without it, no part of the feature delivers value.

**Independent Test**: Can be fully tested by a donor logging into the Donor PWA during an open checkout window and completing the checkout flow through to receipt delivery.

**Acceptance Scenarios**:

1. **Given** a donor has committed items for an event with checkout open, **When** they open the Checkout page, **Then** they see an itemized list of all committed charges with item names and amounts, subtotal, processing fee line item, and grand total.
2. **Given** the checkout page is open, **When** the donor views it, **Then** payment method defaults to Card and the processing fee checkbox is checked (2.9% by default).
3. **Given** the donor selects "Cash" or "Check" as payment method, **When** the page updates, **Then** the processing fee is removed from the total and instructions appear to visit the checkout booth, including the NPO payee name.
4. **Given** the donor selects "Card", **When** they proceed, **Then** they can view and change their payment card before confirming.
5. **Given** the donor is satisfied with their total, **When** they perform the first swipe gesture, **Then** a second confirmation swipe appears.
6. **Given** the donor performs the confirmation swipe, **When** it is accepted, **Then** payment is simulated as successful, a success screen is shown, and a receipt email is sent.
7. **Given** checkout is complete, **When** the donor returns to the app or navigates back to the Checkout page, **Then** the page renders in read-only mode showing the itemized receipt summary, total paid, and a receipt download link; no swipe or payment UI is shown.

---

### User Story 2 - Admin Opens and Controls Checkout (Priority: P1)

An NPO Admin opens the checkout window for an event — either manually at the end of the night or by scheduling an automatic open time — which makes the checkout section visible to donors in the app.

**Why this priority**: Without admin control to open checkout, donors cannot access the checkout flow at all.

**Independent Test**: Can be tested by an admin opening checkout from the admin panel and confirming that the checkout section becomes visible on the donor's My Event page.

**Acceptance Scenarios**:

1. **Given** an event is in progress, **When** the admin manually opens checkout from the Admin PWA, **Then** the checkout section becomes visible to donors immediately.
2. **Given** the admin sets a scheduled checkout open time, **When** that time arrives, **Then** checkout opens automatically without further admin action.
3. **Given** checkout is not yet open, **When** a donor views their My Event page, **Then** no checkout section is visible.
4. **Given** checkout is open, **When** a donor views their My Event page, **Then** a checkout summary card appears at the bottom with their total and a link to the full Checkout page.

---

### User Story 3 - Admin Monitors Checkout Status and Manages Items (Priority: P1)

An NPO Admin views a per-donor checkout status dashboard and can modify any donor's checkout items — adding, removing, or adjusting prices — to resolve disputes or correct errors.

**Why this priority**: Admins need real-time visibility and control to support donors and resolve issues during the high-pressure close of an event.

**Independent Test**: Can be tested by an admin modifying a donor's checkout items and confirming the updated total is reflected on the donor's Checkout page.

**Acceptance Scenarios**:

1. **Given** checkout is open, **When** the admin views the checkout status dashboard, **Then** each registered donor is listed with their checkout status: Not Started, In Progress, or Complete.
2. **Given** a donor's checkout entry, **When** the admin opens it, **Then** they see the donor's full item list and can add, remove, or reprice items.
3. **Given** an admin modifies a donor's items, **When** the donor's Checkout page refreshes, **Then** it reflects the updated items and total.
4. **Given** some donors have not checked out, **When** the admin selects them and sends a reminder, **Then** those donors receive a push notification prompting them to complete checkout.

---

### User Story 4 - Admin Sends Checkout Link (Priority: P2)

An NPO Admin can send a direct link to the Checkout page to selected donors or all donors at any time after checkout has opened, enabling targeted communication to drive checkout completion.

**Why this priority**: Reduces checkout abandonment but is not blocking for the core experience — donors can still access checkout through the app without a direct link.

**Independent Test**: Can be tested by an admin triggering a "Send Checkout Link" action and verifying the notification is received by the targeted donors.

**Acceptance Scenarios**:

1. **Given** checkout is open, **When** the admin chooses to send the checkout link to all donors, **Then** all registered donors receive a notification containing a direct link to the Checkout page.
2. **Given** the admin selects specific donors, **When** the link is sent, **Then** only those donors receive the notification.
3. **Given** checkout has opened, **When** the admin decides to send the link later (not at open time), **Then** the send action is available at any point while checkout is open.

---

### User Story 5 - Donor Contacts Admin from Checkout Page (Priority: P2)

A donor who has a question or concern about a charge on their checkout can send a message directly to the NPO Admin without leaving the Checkout page, and the admin receives it immediately via multiple channels.

**Why this priority**: Reduces checkout abandonment by giving donors a direct escalation path for disputes, without requiring them to find the admin in person.

**Independent Test**: Can be tested by a donor submitting a message from the checkout contact option and verifying the admin receives it via email, push notification, and SMS.

**Acceptance Scenarios**:

1. **Given** a donor is on the Checkout page, **When** they tap the "Contact Admin" option, **Then** a message input appears inline without navigating away.
2. **Given** the donor submits a message, **When** it is sent, **Then** the NPO Admin receives the message via email, push notification, and SMS simultaneously.
3. **Given** the donor submits their message, **When** the modal closes, **Then** their checkout state — items, tips, selected payment method — is fully preserved.

---

### User Story 6 - Donor Tips Auctioneer and FundrBolt (Priority: P2)

During checkout, a donor can optionally tip the auctioneer and/or the FundrBolt development team using preset amounts or a custom value entered via a wheel picker, with sensible pre-selected defaults.

**Why this priority**: Optional add-on revenue with no blocking dependency; can be skipped or defaulted without impacting checkout completion.

**Independent Test**: Can be tested by a donor selecting tip amounts and verifying they appear correctly in the checkout total and on the receipt.

**Acceptance Scenarios**:

1. **Given** the Checkout page, **When** the donor views the Auctioneer Tip section, **Then** they see options for $20, $50, and $100 with $50 pre-selected, plus a custom option backed by a wheel picker.
2. **Given** the Checkout page, **When** the donor views the FundrBolt Tip section, **Then** they see options for $5, $10, and $25 with $0 pre-selected, plus a custom option backed by a wheel picker.
3. **Given** a donor selects or enters any tip amount, **When** the selection is made, **Then** the checkout total updates in real time.
4. **Given** a donor completes checkout with tips, **When** the receipt is generated, **Then** both tips appear as labeled line items on the receipt.
5. **Given** both tip sections, **When** rendered, **Then** they visually match the donation input pattern used on the Donate Now page.

---

### User Story 7 - Admin Manages Receipts (Priority: P2)

An NPO Admin can view, download, and resend receipts for any donor who has completed checkout, supporting record-keeping and donor support.

**Why this priority**: Required for audit and dispute resolution but does not block the primary checkout flow.

**Independent Test**: Can be tested by an admin viewing a completed donor checkout entry, downloading the PDF receipt, and triggering a resend.

**Acceptance Scenarios**:

1. **Given** a donor has completed checkout, **When** the admin views the checkout status dashboard, **Then** the completed donor's entry shows a receipt available indicator.
2. **Given** a receipt entry, **When** the admin clicks download, **Then** the receipt PDF downloads to their device.
3. **Given** a receipt entry, **When** the admin clicks resend, **Then** the receipt email is re-delivered to the donor's address on file.

---

### Edge Cases

- If a donor's checkout items are modified by the admin while the donor is actively on the Checkout page, the page MUST auto-update and display a banner: "Your items were updated by the organizer. Please review before confirming." The donor must acknowledge the change before the swipe-to-confirm gesture is re-enabled.
- If a donor has no committed items when checkout opens, the checkout summary card MUST still appear on the My Event page but MUST display an empty state message (e.g., "You have no items to check out"); no payment flow or swipe UI is shown. If the admin later adds items, the card updates to the standard checkout summary.
- What happens if checkout is closed before a donor finishes?
- What if the donor's receipt email cannot be delivered?
- If a donor attempts to re-open the Checkout page after already completing checkout, the page MUST display in read-only mode showing the itemized receipt summary, total paid, and a receipt download link; the swipe-to-confirm UI is hidden.
- The processing fee rate is snapshotted at the moment the admin opens checkout for the event; all donors for that event use this locked rate regardless of subsequent global configuration changes.
- What if an admin removes all items from a donor's checkout — can the donor proceed with a $0 total or are they excluded?
- What if the scheduled checkout open time passes while no donors are registered?

## Requirements *(mandatory)*

### Functional Requirements

**Donor PWA — Checkout Page**

- **FR-001**: The system MUST provide a dedicated Checkout page in the Donor PWA, accessible only when checkout is open for the event.
- **FR-001a**: After a donor completes checkout, the Checkout page MUST transition to a permanent read-only receipt summary showing the itemized charges, total paid, and a receipt download link; the swipe-to-confirm UI MUST be hidden and the donor MUST NOT be able to re-submit.
- **FR-002**: The Checkout page MUST display a fully itemized list of all committed charges for the donor, including item name and amount per line.
- **FR-003**: The Checkout page MUST include a processing fee line item representing a configurable percentage of the subtotal; the checkbox to include this fee MUST be checked by default.
- **FR-004**: The default processing fee rate MUST be 2.9%, configurable globally by Super Admin. When the admin opens checkout for an event, the current global rate MUST be snapshotted onto the Checkout Configuration for that event; all donors at that event use the snapshotted rate, and subsequent global rate changes do not affect ongoing checkouts.
- **FR-005**: The Checkout page MUST include an Auctioneer Tip section with preset options ($20, $50, $100), a custom entry backed by a wheel picker, and a default selection of $50.
- **FR-006**: The Checkout page MUST include a FundrBolt Development Team Tip section with preset options ($5, $10, $25), a custom entry backed by a wheel picker, and a default selection of $0.
- **FR-007**: Both tip sections MUST visually match the donation input pattern used on the Donate Now page.
- **FR-008**: The Checkout page MUST offer four payment method options: Card (default), Cash, Check, and Donor Advisory Fund (DAF).
- **FR-009**: When Cash or Check is selected, the system MUST remove the processing fee from the total and display checkout booth instructions along with the NPO payee name sourced from NPO Payment Settings.
- **FR-010**: When DAF is selected, the system MUST remove the processing fee from the total and display instructions directing the donor to the checkout booth (same behavior as Cash and Check).
- **FR-011**: When Card is selected, the donor MUST be able to view and change their payment card before confirming.
- **FR-012**: Checkout confirmation MUST require two sequential swipe gestures, using the same interaction pattern as the Donate Now page.
- **FR-013**: Payment processing MUST simulate a successful outcome (stubbed) with no real payment gateway call at this stage.
- **FR-014**: Upon simulated successful checkout, the donor MUST receive an email containing the event logo in the header, event details, and a PDF receipt as an attachment.
- **FR-015**: The donor MUST be able to download and view their receipt PDF from within the Donor PWA after checkout is complete.
- **FR-016**: The Checkout page MUST include a "Contact Admin" option that sends the donor's typed message to the NPO Admin via email, push notification, and SMS simultaneously.
- **FR-017**: The donor's in-progress checkout state (items, tips, payment method selection) MUST be preserved across page navigation and app backgrounding.
- **FR-017a**: If the admin modifies a donor's checkout items while the donor is on the Checkout page, the page MUST automatically update to reflect the change and display a visible banner: "Your items were updated by the organizer. Please review before confirming." The swipe-to-confirm gesture MUST be disabled until the donor has scrolled past or dismissed the banner.

**Donor PWA — My Event Page**

- **FR-018**: A checkout summary card MUST appear at the bottom of the My Event page when the admin has enabled checkout visibility for the event.
- **FR-018a**: If a donor has no committed items at the time the checkout card is shown, the card MUST display an empty state message (e.g., "You have no items to check out") with no link to a payment flow; if the admin subsequently adds items to that donor's checkout, the card MUST update to the standard checkout summary.
- **FR-019**: The checkout card MUST display the donor's estimated total and provide a direct link to the Checkout page.
- **FR-020**: After the donor completes checkout, the checkout card MUST update to show a "Checkout Complete" status with a receipt download link.

**Admin PWA — Checkout Control**

- **FR-021**: The admin MUST be able to manually open checkout for a specific event from the Admin PWA.
- **FR-022**: The admin MUST be able to schedule checkout to open automatically at a specified future date and time.
- **FR-023**: Opening checkout — whether manual or scheduled — MUST simultaneously make the checkout summary card visible on the donor's My Event page.
- **FR-024**: The admin MUST be able to send a checkout link notification to all donors or a selected subset of donors at any time while checkout is open.
- **FR-025**: The admin MUST have access to a per-donor checkout status dashboard listing each donor's checkout state: Not Started, In Progress, or Complete.
- **FR-026**: The admin MUST be able to open any donor's checkout and add items, remove items, or change item prices.
- **FR-026a**: Every admin modification to a donor's checkout (item added, removed, or repriced) MUST be recorded in an audit log capturing: acting admin identity, timestamp, the specific change made, and the before/after values for any modified fields.
- **FR-027**: The admin MUST be able to send a checkout reminder push notification to individual donors or a selected group of donors who have not yet completed checkout.
- **FR-028**: The admin MUST be able to view, download, and resend the receipt for any donor who has completed checkout.

### Key Entities

- **Checkout Session**: Represents a single donor's checkout for a specific event; tracks status (not started, in progress, complete), item list, selected payment method, processing fee opt-in, tip amounts, and completion timestamp.
- **Checkout Item**: A single charge line within a checkout session; includes name, description, original amount, admin-adjusted amount, and source type (e.g., auction win, purchase).
- **Checkout Configuration**: Per-event settings including checkout open/close status, scheduled open time, checkout section visibility for donors, cash/check instructions, and the snapshotted processing fee rate captured at checkout-open time.
- **Processing Fee Configuration**: Global setting for the default processing fee percentage, managed by Super Admin.
- **Checkout Receipt**: A generated PDF document summarizing the completed checkout; attached to the confirmation email and available for in-app download.
- **Auctioneer Tip**: An optional gratuity added to the checkout total, attributed to the auctioneer.
- **Platform Tip**: An optional gratuity added to the checkout total, attributed to the FundrBolt development team.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Donors can complete the full checkout flow — from reviewing items to confirmed payment — in under 5 minutes.
- **SC-002**: Receipt emails are delivered to donors within 2 minutes of checkout confirmation.
- **SC-003**: 100% of completed checkouts have an accessible, downloadable PDF receipt visible in both admin and donor views.
- **SC-004**: Admin can open checkout, view the full donor status dashboard, and send reminder notifications with no more than 3 interactions from the event management screen.
- **SC-005**: Admin modifications to a donor's checkout items are reflected in the donor's view within 10 seconds.
- **SC-006**: Reminder notifications reach all targeted donors within 60 seconds of the admin triggering the send action.
- **SC-007**: Donors with no committed items see the checkout card in an empty state ("You have no items to check out") rather than an error or a blank page, and the card updates if items are later added by an admin.

## Assumptions

- Payment processing is stubbed/simulated for this feature; no real payment gateway integration is in scope.
- Checkout items include all charges incurred by the donor during the event: auction wins, revenue generator entries (e.g., golden ticket), paddle raise pledges, and any outstanding ticket balances.
- The payee name for cash/check instructions already exists in NPO Payment Settings (existing data field).
- The auctioneer tip is attributed to the NPO or auctioneer entity associated with the event; exact fund routing is an accounting concern outside this feature's scope.
- FundrBolt platform tips are tracked separately in the system for internal accounting.
- The double-swipe confirmation UI pattern exists on the Donate Now page and is reused without modification.
- The wheel picker UI component exists from the Donate Now page and is reused without modification.
- Checkout can be opened once per event; behavior around re-opening or closing mid-event is out of scope for this iteration.
- SMS delivery for the donor-to-admin contact message relies on existing notification infrastructure.

## Clarifications

### Session 2026-05-05

- Q: Should admin modifications to a donor's checkout be audit-logged with full attribution and before/after values? → A: Yes — all admin modifications are logged with admin identity, timestamp, field changed, and before/after value (FR-026a).
- Q: How should the Checkout page behave when an admin modifies a donor's items while the donor is actively reviewing? → A: Page auto-updates with a visible banner requiring the donor to acknowledge the change before the swipe-to-confirm is re-enabled (FR-017a).
- Q: What state does the Checkout page show after a donor has already completed checkout? → A: Read-only receipt summary (itemized charges, total, download link); swipe UI hidden; re-submission not possible (FR-001a).
- Q: What should the checkout card show for donors with no committed items? → A: Card appears with an empty state message ("You have no items to check out"); no payment flow shown; card updates if admin later adds items (FR-018a).
- Q: When should the processing fee rate be snapshotted to protect donors from mid-event global config changes? → A: Rate is snapshotted onto the event's Checkout Configuration when the admin opens checkout; all donors for that event use the locked rate (FR-004).
