# Feature Specification: Payment Processing

**Feature Branch**: `033-payment-processing`
**Created**: March 10, 2026
**Status**: Draft
**Input**: User description: "payment processing"

## Clarifications

### Session 2026-03-10

- Q: When a payment processor webhook/IPN is not received after a donor completes the hosted form, how should unresolved pending transactions be handled? → A: Webhook/IPN is the primary confirmation signal; if not received within a configurable window, the system polls the processor to retrieve the transaction status and auto-resolves it.
- Q: Can a donor delete their only saved card when they have an outstanding event balance? → A: Allow deletion but display a warning that no payment method will remain on file; flag the donor's account as "no payment method on file" in the admin donor list.
- Q: Must partial refunds map to specific line items, or can they be an arbitrary dollar amount? → A: Arbitrary dollar amount up to the transaction total — no line-item mapping or item status reversal required.
- Q: Which staff roles can initiate charges and refunds vs. view balances only? → A: NPO Admin and Co-Admin can initiate charges, voids, and refunds; Check-in Staff and NPO Staff can view outstanding balances only.
- Q: Can donors add a voluntary extra amount at end-of-night checkout, and can they opt to cover processing fees? → A: Yes — donors can enter an optional extra donation amount at checkout confirmation; they can also choose to cover the processing fee (this option is checked by default). Both appear as separate line items on the receipt.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — NPO Configures Payment Account (Priority: P1)

A Fundrbolt super admin enters and manages the payment processor credentials for each nonprofit
organization. This links the NPO to their First American / Deluxe merchant account so that funds
collected during events flow to the NPO's own bank account. Credentials are stored securely and
are never displayed in full after saving. A "Test Connection" button allows admins to verify the
credentials are valid before any real donors are charged.

**Why this priority**: Without payment credentials in place, no NPO can collect payments at all.
This is the prerequisite for every other payment flow.

**Independent Test**: As a super admin, open an NPO's payment settings, enter credentials, save,
click "Test Connection", and confirm a success or error state is clearly communicated.

**Acceptance Scenarios**:

1. **Given** a super admin on an NPO's payment settings page, **When** they enter valid credentials and save, **Then** the NPO is enabled for payment collection and the saved state is confirmed.
2. **Given** previously saved credentials, **When** a super admin views the page, **Then** credentials are shown masked (e.g., only last few characters visible) and cannot be read in full.
3. **Given** invalid credentials, **When** a super admin clicks "Test Connection", **Then** a clear error is shown before any save occurs.
4. **Given** valid sandbox credentials and "Test Connection" clicked, **Then** a success confirmation is shown.
5. **Given** an NPO with no payment credentials configured, **When** any payment action is attempted for that NPO's event, **Then** users see an informative message that payments are not yet set up and are directed to contact the organizer.

---

### User Story 2 — Donor Sets Up a Payment Method (Priority: P1)

A registered donor stores their payment card through a secure form operated by the payment
processor (First American / Deluxe). The card entry form is hosted entirely by the payment
processor — Fundrbolt never receives or stores raw card numbers. After the card is saved, a
masked summary (brand, last 4 digits, expiry) appears in the donor's payment settings for use
across all of that nonprofit's events.

**Why this priority**: Every checkout flow depends on the donor having a saved card on file.
Without this step, ticket purchases and end-of-night checkout are blocked.

**Independent Test**: Log in as a donor, navigate to payment methods, complete the hosted card
form, and confirm the masked card appears in the saved methods list.

**Acceptance Scenarios**:

1. **Given** a logged-in donor with no saved cards, **When** they complete the hosted card entry form, **Then** a masked card (brand + last 4 + expiry) appears in their saved methods.
2. **Given** a donor with one saved card, **When** they add a second card, **Then** both cards appear; the original default is unchanged until the donor updates it.
3. **Given** a donor with multiple cards, **When** they mark a different card as default, **Then** that card is pre-selected in all future checkout flows.
4. **Given** a donor with a saved card, **When** they delete it, **Then** the card is removed and can no longer be charged.

---

### User Story 3 — Public Visitor Browses Ticket Prices (Priority: P2)

An anonymous visitor (someone who received an event invitation but has not yet registered) can
view the available ticket packages for an event — names, descriptions, seat counts, and prices —
without logging in. When they decide to purchase, the system guides them to create an account and
set up a payment method before returning them to complete the purchase.

**Why this priority**: This is the top-of-funnel step. Prospective donors must be able to see
what they are buying before committing to registration.

**Independent Test**: Access the event's public ticket URL while logged out. Confirm ticket
packages are visible. Click "Buy Tickets" and confirm a redirect to the registration flow.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor on the event ticket page, **When** the page loads, **Then** all enabled ticket packages are shown with name, description, price, and availability.
2. **Given** an unauthenticated visitor clicking "Buy Tickets", **Then** they are redirected to account registration, and after completing registration and payment setup they are returned to purchase the selected package.
3. **Given** an unauthenticated visitor clicking "Already have an account? Sign in", **Then** they are taken to the login page and returned to the ticket page after signing in.
4. **Given** an event with no enabled ticket packages, **Then** a "Tickets are not currently available" message is shown instead.

---

### User Story 4 — Registered Donor Purchases Tickets (Priority: P2)

A registered, logged-in donor selects a ticket package, optionally applies a promo code, picks a
saved payment method (or adds a new one), reviews the total, and confirms the purchase. On success
they receive an email receipt and their ticket purchase is recorded.

**Why this priority**: Ticket sales are a primary revenue source for nonprofits. Self-service
purchase eliminates manual staff processing and enables advance ticket revenue.

**Independent Test**: Log in as a donor, navigate to an event's ticket page, select a package,
complete checkout with a saved card, and confirm a success screen appears and a receipt email is
delivered.

**Acceptance Scenarios**:

1. **Given** a logged-in donor with a saved card and available tickets, **When** they select a package and confirm payment, **Then** the purchase is recorded, ticket availability decreases, and a receipt is emailed.
2. **Given** a donor applying a valid promo code, **When** they submit it, **Then** the discounted total is shown before confirmation.
3. **Given** a donor submitting an invalid or expired promo code, **Then** an error explains the code is not valid.
4. **Given** a donor with no saved card at the payment step, **Then** they are prompted to add a card via the hosted form before proceeding.
5. **Given** a ticket package that has reached its quantity limit, **Then** it is shown as sold out and cannot be selected.
6. **Given** a donor whose card is declined, **Then** an error is shown and the donor can retry with a different card without being double-charged.

---

### User Story 5 — Donor Completes End-of-Night Checkout (Priority: P3)

After the event's auction and paddle raise conclude, a donor sees an itemized summary of
everything they owe — auction wins, donations, and any unpaid ticket balance — and pays the total
in a single transaction using their saved payment method. Items already paid (e.g., tickets
purchased in advance) do not appear in the outstanding balance.

**Why this priority**: This is the primary revenue-collection moment at the event. A smooth
self-service checkout reduces staff burden and ensures funds are collected before donors leave.

**Independent Test**: After checkout is opened for an event, log in as a donor with auction wins
and donations, view the checkout page, confirm the itemized balance, pay, and confirm a combined
receipt is emailed.

**Acceptance Scenarios**:

1. **Given** checkout is open and a donor has auction wins and donations, **When** they visit the checkout page, **Then** they see an itemized list of all outstanding items with a total.
2. **Given** a donor who paid for tickets in advance, **When** they reach end-of-night checkout, **Then** the ticket cost is absent from the outstanding balance.
3. **Given** the checkout confirmation screen, **Then** an optional extra donation field and a processing fee coverage checkbox (checked by default) are both visible with the calculated fee shown.
4. **Given** a donor who leaves the extra donation blank and unchecks the fee coverage box, **When** they confirm, **Then** only their computed balance is charged.
5. **Given** a donor who enters an extra donation amount and leaves fee coverage checked, **When** they confirm, **Then** the total charged includes the balance, the extra donation, and the processing fee; all three appear as separate line items on the receipt.
6. **Given** a donor with a saved default card, **When** they confirm checkout, **Then** the total is charged and a receipt is emailed.
7. **Given** a donor with no saved card who opens the checkout page, **Then** they are prompted to add a payment method before paying.
8. **Given** a donor whose full balance is already paid, **When** they open the checkout page, **Then** a zero-balance confirmation is shown and no charge is initiated.

---

### User Story 6 — Admin Charges a Donor on Their Behalf (Priority: P3)

An event coordinator or NPO admin can initiate a charge against a specific donor's saved payment
method — for example, when a donor leaves without completing self-checkout. The admin selects the
donor, reviews their outstanding balance, and triggers the charge. A receipt is automatically sent
to the donor and the action is logged with the staff member's identity.

**Why this priority**: Essential fallback that ensures NPOs can collect payment even when donors
do not self-serve. Prevents revenue loss at the end of event night.

**Independent Test**: As an NPO admin, open a donor's event profile, view their outstanding
balance, click "Charge Now", provide a reason, confirm, and verify the donor's transaction history
is updated and a receipt email is sent to the donor.

**Acceptance Scenarios**:

1. **Given** a donor with an outstanding balance and a saved card, **When** an admin initiates a charge with a reason, **Then** the card is charged, logged with the admin's identity, and the donor receives a receipt.
2. **Given** a donor with no saved payment method, **When** an admin attempts to charge them, **Then** the system blocks the charge and shows a message that no payment method is on file.
3. **Given** any admin-initiated charge, **Then** the audit log records who initiated it, when, and the stated reason.

---

### User Story 7 — Admin Issues a Refund or Void (Priority: P4)

An NPO admin can void an unsettled transaction (before it clears the bank) or refund a settled
one in full or in part. The donor is notified by email for both outcomes.

**Why this priority**: Necessary for error correction and dispute resolution. Lower priority than
collection flows since it is an exception path.

**Independent Test**: As an NPO admin, locate a completed transaction, issue a full refund,
confirm the transaction status updates, and confirm the donor receives a notification email.

**Acceptance Scenarios**:

1. **Given** an unsettled transaction, **When** an admin voids it, **Then** no funds transfer and the transaction is marked voided.
2. **Given** a settled transaction, **When** an admin issues a full refund, **Then** the full amount is returned to the donor's card.
3. **Given** a settled transaction, **When** an admin issues a partial refund with a reason, **Then** only the specified amount is returned and the transaction record reflects the partial refund.
4. **Given** a refund or void being processed, **Then** the donor receives an email reflecting the updated amount.

---

### User Story 8 — Donor Receives a PDF Receipt by Email (Priority: P2)

Every successful payment — whether donor-initiated or admin-initiated — automatically generates a
PDF receipt that is emailed to the donor. The receipt includes a full itemized breakdown, total
paid, masked payment method, and event details. If email delivery fails, the receipt remains
accessible through the donor's transaction history in the app.

**Why this priority**: Donors need receipts for personal records and potential tax purposes;
nonprofits need documented transaction evidence. Automating this removes staff effort.

**Independent Test**: Complete any payment and verify a PDF receipt email arrives within 5 minutes,
the PDF contains all required line items with correct amounts, and the receipt is also accessible
via the donor's in-app transaction history.

**Acceptance Scenarios**:

1. **Given** a completed payment, **When** the transaction is confirmed, **Then** a PDF receipt is generated and emailed to the donor automatically without any manual action.
2. **Given** a receipt email, **Then** the PDF contains: NPO name and branding, event name and date, donor name, itemized line items (each ticket / auction win / donation with its own amount), total paid, card brand and last 4 digits, transaction ID, and transaction date/time.
3. **Given** a refund or void, **When** processed, **Then** the donor receives an updated email reflecting the changed amount.
4. **Given** a receipt email that fails to deliver, **Then** the receipt PDF remains available in the donor's transaction history within the app.

---

### Edge Cases

- What happens when a donor's card is declined mid-checkout? The system must retain the pending
  order and allow retry without issuing a duplicate charge.
- What happens if a donor submits the checkout form twice (double-click or two devices active at
  once)? Exactly one charge must occur.
- What happens if the payment processor's hosted card form becomes temporarily unavailable? Users
  must see a clear error rather than a broken or stuck page.
- What happens when a donor's saved card has expired? The card should remain visible with an
  expiry warning so the donor knows to add a replacement before the event.
- What happens when the end-of-night total is $0 (e.g., everything was comped or already paid)?
  The checkout page must confirm a zero balance without initiating any charge.
- What happens if an admin tries to charge more than the donor's recorded outstanding balance?
  The system should show a warning and require explicit confirmation of the override.
- What happens if receipt generation fails? The payment must still be recorded as complete; the
  receipt failure should be flagged for retry without blocking confirmation to the donor.
- What happens if the payment processor's webhook/IPN never arrives after a donor completes the
  hosted card form? The transaction must not remain stuck in a pending state indefinitely — the
  system must poll the processor for the transaction outcome after a configurable timeout and
  resolve the status automatically.

---

## Requirements *(mandatory)*

### Functional Requirements

**Payment Method Management**

- **FR-001**: Registered donors MUST be able to save a payment card through a form hosted entirely by the payment processor, so that card data is never transmitted to or stored by Fundrbolt.
- **FR-002**: Donors MUST be able to view their saved cards showing only brand, last 4 digits, and expiry — no full card number is ever displayed.
- **FR-003**: Donors MUST be able to designate one card as their default payment method.
- **FR-004**: Donors MUST be able to remove a saved card at any time. If the donor has an outstanding balance for any active event and the card being removed is their last saved method for that NPO, the system MUST display a warning before confirming deletion. The deletion MUST still be permitted after the warning is acknowledged.
- **FR-005**: Saved payment methods MUST be scoped per nonprofit — a card saved for one NPO is available across all of that NPO's events but is not shared with other NPOs.

**Public Ticket Browsing**

- **FR-006**: Unauthenticated visitors MUST be able to view enabled ticket packages for an event without logging in.
- **FR-007**: The public ticket page MUST display each package's name, description, price, and remaining availability.
- **FR-008**: When an unauthenticated visitor clicks "Buy Tickets", the system MUST redirect them to registration, preserving the selected package so checkout resumes after account creation and payment setup.

**Ticket Purchase**

- **FR-009**: Registered donors MUST be able to purchase ticket packages for events where ticket sales are open.
- **FR-010**: The checkout flow MUST present a clear price breakdown — original price, promo discount (if any), and final total — before any charge is confirmed.
- **FR-011**: Valid promo codes MUST reduce the displayed and charged price before the donor confirms payment.
- **FR-012**: Ticket purchase MUST be blocked when a package has reached its quantity limit.
- **FR-013**: On successful purchase, the donor's ticket count and the package's sold count MUST be updated immediately.

**End-of-Night Checkout**

- **FR-014**: Once checkout is open for an event, donors MUST be able to view an itemized summary of their outstanding balance (auction wins + donations + any unpaid ticket balance).
- **FR-015**: The end-of-night checkout MUST support paying the entire outstanding balance in a single transaction.
- **FR-015a**: The end-of-night checkout confirmation screen MUST offer an optional extra donation field so donors can add a voluntary amount on top of their computed balance. This extra amount MUST appear as a distinct line item on the receipt.
- **FR-015b**: The end-of-night checkout confirmation screen MUST offer an opt-out checkbox allowing the donor to cover the payment processing fee. This checkbox MUST be checked by default. The processing fee amount MUST be calculated and displayed before the donor confirms. If the donor unchecks it, the fee is absorbed by the NPO. The fee coverage amount MUST appear as a distinct line item on the receipt when the donor elects to pay it.
- **FR-016**: End-of-night checkout MUST become accessible to donors automatically when the event status changes to "closed". Coordinators MUST also be able to explicitly open or close checkout at any time via an admin control, independent of event status — this allows early release or temporary holds as needed.
- **FR-017**: Items the donor has already paid for (e.g., advance ticket purchase) MUST NOT be included in the end-of-night outstanding balance.

**Admin-Initiated Payments**

- **FR-018**: NPO Admins, Co-Admins, and Staff MUST be able to view any donor's outstanding balance for an event from the admin panel. Donors who have an outstanding balance but no saved payment method on file MUST be visually flagged in the donor list so coordinators can follow up.
- **FR-019**: NPO Admins and Co-Admins MUST be able to charge a donor's saved card on the donor's behalf, with a mandatory reason field. Check-in Staff and NPO Staff do NOT have permission to initiate charges.
- **FR-020**: Every admin-initiated charge MUST record the identity of the staff member who triggered it in an immutable audit log.

**Refunds and Voids**

- **FR-021**: NPO Admins and Co-Admins MUST be able to void a transaction that has not yet settled with the bank.
- **FR-022**: NPO admins MUST be able to issue a full or partial refund on a settled transaction. A partial refund is an arbitrary dollar amount chosen by the admin — it does not need to correspond to specific line items, and no auction item status or bid records are modified as a result.
- **FR-023**: The refund amount MUST NOT exceed the original transaction amount.

**Receipts**

- **FR-024**: Every successful charge — donor-initiated or admin-initiated — MUST automatically generate a PDF receipt and email it to the donor.
- **FR-025**: Receipts MUST include: NPO name and branding, event name and date, donor name, itemized line items with individual amounts (tickets, auction wins, donations, optional extra donation, and processing fee coverage if elected), total paid, masked payment method (brand + last 4), transaction ID, and timestamp.
- **FR-026**: Receipts for refunds and voids MUST clearly reflect the updated transaction status and adjusted amount.
- **FR-027**: If receipt email delivery fails, the receipt MUST remain retrievable from the donor's transaction history within the app.

**NPO Payment Configuration**

- **FR-028**: Super admins MUST be able to enter, update, and delete payment processor credentials for each NPO.
- **FR-029**: Payment credentials MUST be masked in all UI views after saving and MUST NOT be retrievable in full through the application.
- **FR-030**: Super admins MUST be able to test credentials before activating them to confirm they are valid.
- **FR-031**: Each NPO MUST have its own separate merchant account with the payment processor. Funds collected at an NPO's event MUST settle directly into that NPO's bank account. Fundrbolt MUST NOT act as an intermediary holder or disburser of collected funds.

**General**

- **FR-032**: When the payment processor's hosted form is unavailable, the system MUST display a user-friendly error and prevent any partial or duplicate charges from being created.
- **FR-033**: All payment-related actions (charges, voids, refunds, admin overrides) MUST be logged with timestamp, actor identity, amount, and outcome for audit purposes.
- **FR-034**: The payment processor webhook/IPN MUST be the primary signal for confirming a transaction outcome. If no webhook is received within a configurable time window after a payment session is initiated, the system MUST poll the processor's status API to retrieve the outcome and automatically resolve the transaction to its final status (captured, declined, or error). Transactions MUST NOT remain in a pending state indefinitely.
- **FR-035**: When an NPO Admin or Co-Admin initiates a charge against a donor whose recorded outstanding balance is zero or whose requested charge amount exceeds the recorded outstanding balance, the system MUST display a warning and require explicit confirmation before proceeding. The charge MUST be permitted after acknowledgment — this override path allows staff to collect amounts not yet recorded in the system (e.g., cash-equivalent donations entered after the fact).

### Key Entities

- **Payment Method (Saved Card)**: A tokenized reference to a donor's card held in the payment processor's secure vault. Displays brand, last 4 digits, and expiry to the user but never raw card data. Scoped to donor + nonprofit.
- **Transaction**: A single payment event (charge, void, or refund) with a lifecycle status (pending → authorized → captured → voided / refunded / declined), an amount, an itemized breakdown, and a link to both the paying donor and any staff member who initiated it.
- **Receipt**: A generated PDF document summarizing a transaction. Linked to the transaction, stored for retrieval, and tracks whether email delivery succeeded.
- **NPO Payment Configuration**: The set of credentials that connects a specific nonprofit to their merchant account with the payment processor. Determines where collected funds are deposited. Managed by super admins only.
- **End-of-Night Balance**: A computed view of all items a donor owes at end of event — derived from their auction wins, donations, and any unpaid ticket amounts, minus amounts already paid. Does not include the optional extra donation or processing fee coverage, which are added at checkout confirmation time.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Donors can complete end-of-night checkout (from opening the page to payment confirmation) in under 3 minutes.
- **SC-002**: PDF receipts are delivered to donors' email addresses within 5 minutes of a successful payment confirmation.
- **SC-003**: 100% of card data is captured through the payment processor's hosted form — Fundrbolt's systems never receive, transmit, or store raw card numbers.
- **SC-004**: Submitting a checkout form twice (double-click or concurrent sessions) results in exactly one charge — no duplicate payments occur.
- **SC-005**: Donors can add, view, set default, and remove saved payment methods entirely without requiring help from event staff.
- **SC-006**: 100% of completed transactions have a corresponding receipt accessible in the donor's in-app transaction history, even when email delivery fails.
- **SC-007**: Every refund or void is reflected in the donor's transaction history and the NPO's payment view within 1 minute of processing.
- **SC-008**: Admin-initiated charges against donor saved cards complete successfully for all donors who have a valid saved card on file.

---

## Assumptions

- Each NPO has (or will have) its own separate merchant account with First American / Deluxe, and funds settle directly into the NPO's bank account. Fundrbolt never holds or disburses collected funds.
- The payment processor's hosted card form signals form completion back to the application (e.g., via browser redirect or in-page message) so Fundrbolt can confirm a card was saved without receiving card data itself.
- A donor can save multiple cards per nonprofit but only one is the default at any given time.
- The distinction between "voidable" (unsettled) and "refundable only" (settled) is determined by the payment processor and communicated to Fundrbolt — application logic does not independently calculate settlement timing.
- Each NPO can operate in sandbox/test mode independently, allowing setup and testing without real charges.
- Tickets purchased in advance are stored with their payment status; the end-of-night checkout service deducts already-paid amounts when computing the outstanding balance.
