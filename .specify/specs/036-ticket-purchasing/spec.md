# Feature Specification: Ticket Purchasing & Assignment

**Feature Branch**: `036-ticket-purchasing`
**Created**: 2026-03-12
**Status**: Draft
**Input**: User description: "Donor PWA ticket purchasing flow — browse tickets, sign in, add to cart, checkout with payment, assign tickets to guests, email invitations, guest self-registration, sponsorship info collection for sponsor-tier packages."

## Clarifications

### Session 2026-03-12

- Q: When multiple donors compete for the last few tickets simultaneously, how should the system manage inventory? → A: Soft oversell with coordinator resolution — allow slight overselling; event coordinator manually resolves conflicts (e.g., upgrading to a different package, issuing refunds).
- Q: When should custom ticket option questions (e.g., "T-shirt size", "Dietary restrictions") be answered? → A: During guest registration — each guest answers their own custom questions when they register for the event.
- Q: Must invited guests create a full user account to register for the event? → A: Yes, full account required (email/password or social login). Ensures guests can log in later to access all event features (auction, seating, checkout).
- Q: After a guest has completed registration through a ticket assignment, can the registration be cancelled? → A: Both coordinator and self-service cancellation allowed. Either the coordinator or the guest can cancel, returning the ticket to the purchaser's unassigned pool for reassignment.
- Q: Should there be a cap on total tickets a donor can purchase per event? → A: Configurable per-event limit — event coordinators set a maximum tickets-per-donor cap (e.g., 20) with a reasonable default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Public Ticket Browsing (Priority: P1)

An anonymous visitor discovers an event (via link, QR code, or social media) and lands on the public event page. They can see the event details — date, time, venue, description, banner — and a list of available ticket packages with names, descriptions, prices, and seats included. Sold-out packages are visually distinguished but still visible. The visitor can see everything they need to make a purchasing decision without creating an account. A prominent "Buy Tickets" call-to-action prompts them to sign in or create an account.

**Why this priority**: Without a public-facing event + ticket page, there is no entry point for the purchasing funnel. This is the top of the conversion funnel and must exist before any other flow works.

**Independent Test**: Can be fully tested by navigating to an event URL as an unauthenticated user and confirming that event details and ticket packages are displayed with a sign-in prompt on the purchase CTA.

**Acceptance Scenarios**:

1. **Given** an event with published ticket packages, **When** an anonymous visitor navigates to the event page, **Then** they see event details (name, date, time, venue, description, banner image) and a list of ticket packages showing name, description, price, and seats per package.
2. **Given** a ticket package that has reached its quantity limit, **When** a visitor views the event page, **Then** that package is shown as "Sold Out" and the purchase button is disabled for it.
3. **Given** a visitor viewing ticket packages, **When** they click "Buy Tickets" on any package, **Then** they are prompted to sign in or create an account, with a return path back to the ticket page after authentication.
4. **Given** an event with no ticket packages configured, **When** a visitor navigates to the event page, **Then** the ticket section is hidden or shows a message that tickets are not yet available.

---

### User Story 2 — Multi-Package Cart & Checkout (Priority: P1)

An authenticated donor browses ticket packages for an event and adds one or more packages to a shopping cart, choosing quantities for each. The cart enforces per-package quantity limits set by the event coordinator. The donor can review their cart, apply a promo code for a discount, and proceed to checkout. At checkout they enter payment information (using the hosted payment form for card entry). Upon successful payment, an order confirmation is displayed and a confirmation email with receipt is sent.

**Why this priority**: This is the core revenue-generating flow. Without cart and checkout, no tickets can be sold.

**Independent Test**: Can be fully tested by logging in, adding packages to the cart, applying a promo code, completing payment, and verifying the order confirmation and receipt.

**Acceptance Scenarios**:

1. **Given** an authenticated donor on the event ticket page, **When** they select a quantity for a package and click "Add to Cart", **Then** the package and quantity are added to the cart and the cart badge updates to reflect the total number of tickets.
2. **Given** a package with a per-person quantity limit of 4, **When** the donor tries to add 5 of that package, **Then** the system prevents it and displays the maximum allowed quantity.
3. **Given** an event with a per-donor ticket cap of 20, **When** the donor's cart already contains 18 tickets and they try to add a package with 4 seats, **Then** the system prevents it and displays a message explaining the per-event limit.
3. **Given** a donor with items in the cart, **When** they view the cart, **Then** they see each package with its quantity, unit price, line total, and the overall order total.
4. **Given** a donor at checkout, **When** they enter a valid promo code, **Then** the discount is applied and the updated total is displayed.
5. **Given** a donor at checkout, **When** they enter an invalid or expired promo code, **Then** an error message explains why the code cannot be applied.
6. **Given** a donor completing payment, **When** the payment is successful, **Then** an order confirmation screen is shown with a summary of purchased tickets and a confirmation email is sent.
7. **Given** a donor completing payment, **When** the payment fails, **Then** a clear error message is shown and they can retry or choose a different payment method.
8. **Given** a donor with items in the cart for a package that has exceeded its configured quantity limit, **When** they attempt checkout, **Then** the system allows the purchase to proceed (soft oversell) and flags the oversold package for coordinator review.

---

### User Story 3 — Ticket Inventory & Assignment (Priority: P1)

After purchasing tickets, the donor sees a "My Tickets" inventory showing all their purchased tickets grouped by event. Each ticket shows its assignment status — unassigned, assigned (pending registration), or registered. The donor can assign individual tickets to guests by entering a name and email address. They can also assign a ticket to themselves. Assigning a ticket to themselves triggers an inline self-registration flow (collecting any required info such as meal selection). Tickets can be reassigned before the guest has completed registration.

**Why this priority**: Ticket assignment is the bridge between purchasing and event attendance. Purchased tickets have no value until they are assigned and guests are registered.

**Independent Test**: Can be fully tested by purchasing tickets, navigating to the ticket inventory, assigning tickets to guests (including self), and verifying assignment status updates.

**Acceptance Scenarios**:

1. **Given** a donor who has purchased tickets, **When** they navigate to their ticket inventory, **Then** they see all purchased tickets grouped by event, showing package name, total seats, assigned count, and unassigned count.
2. **Given** a donor viewing unassigned tickets, **When** they click "Assign" on a ticket, **Then** a form appears to enter the guest's name and email address.
3. **Given** a donor assigning a ticket, **When** they enter a valid name and email and confirm, **Then** the ticket status changes to "Assigned — Pending Registration" and shows the guest's name.
4. **Given** a donor assigning a ticket to themselves (using their own email), **When** they confirm, **Then** they are prompted to complete their own registration for the event (selecting meal preferences, etc.) without needing to go through an email invitation flow.
5. **Given** a donor who has assigned a ticket to a guest who has NOT yet registered, **When** they view that ticket, **Then** they can reassign it to a different person or cancel the assignment.
6. **Given** a donor who has assigned a ticket to a guest who HAS completed registration, **When** they view that ticket, **Then** reassignment is not directly available — the registration must first be cancelled (by the guest or a coordinator) before the ticket can be reassigned.
7. **Given** a registered guest who cancels their own registration, **When** the cancellation is confirmed, **Then** the ticket returns to "Unassigned" in the purchaser's inventory and is available for reassignment.
7. **Given** a donor with a mix of assigned and unassigned tickets, **When** they view their inventory, **Then** the display clearly distinguishes unassigned tickets, pending assignments, and completed registrations with appropriate visual indicators.

---

### User Story 4 — Guest Invitation & Registration (Priority: P2)

When a donor assigns a ticket to a guest, the donor can send an email invitation to that guest. The invitation email contains the event details, a personalized message, and a link to register. When the guest clicks the link, they are directed to create an account (or sign in if they already have one) and then complete their event registration — providing their information and selecting meal preferences. Once registration is complete, the guest can log into the donor PWA and see the event on their home page with full access to event features (auction, seating, etc.).

**Why this priority**: Guest registration completes the ticket lifecycle and populates the event's guest list. It depends on ticket assignment (US3) being functional first.

**Independent Test**: Can be tested by assigning a ticket, sending an invitation email, clicking the invitation link in a separate browser session, creating an account, completing registration, and confirming event access.

**Acceptance Scenarios**:

1. **Given** a donor who has assigned a ticket to a guest, **When** they click "Send Invitation", **Then** an email is sent to the guest's email address containing event details, a registration link, and the donor's name as the inviter.
2. **Given** a guest who received an invitation email, **When** they click the registration link, **Then** they are directed to the donor PWA with the event context pre-loaded and prompted to create an account or sign in.
3. **Given** a guest who has created an account from an invitation, **When** they complete the registration form (providing personal details, meal selections, and answering any custom ticket option questions for the package), **Then** their registration is confirmed, the ticket status in the purchaser's inventory updates to "Registered", and the guest appears on the event's guest list.
4. **Given** a guest who has completed registration, **When** they log into the donor PWA, **Then** the event appears on their home page and they have full access to event features (auction browsing, seating info, etc.).
5. **Given** a donor viewing their ticket inventory, **When** a guest completes registration, **Then** the ticket's status updates to "Registered" with the guest's name (may require page refresh or polling).
6. **Given** a guest who already has an account, **When** they click the invitation link, **Then** they are prompted to sign in (not re-register) and then complete event registration.

---

### User Story 5 — Sponsorship Package Info Collection (Priority: P2)

Some ticket packages are flagged as sponsorship packages (e.g., "Gold Sponsor Table"). When a donor adds a sponsorship package to their cart and proceeds to checkout, an additional step collects sponsorship details: company/sponsor name, logo upload, website URL, and optionally a sponsor level description and contact information. This information is used to create a sponsor entry for the event, which will appear on the event page's sponsor carousel. Sponsorship details must be provided before payment can be completed.

**Why this priority**: Sponsorship packages are a premium revenue stream. The info collection is an extension of the checkout flow (US2) and only triggers for specific package types.

**Independent Test**: Can be tested by adding a sponsorship package to the cart, completing the sponsorship info form, and verifying that a sponsor entry appears on the event page after purchase.

**Acceptance Scenarios**:

1. **Given** a donor adds a sponsorship-flagged package to the cart, **When** they proceed to checkout, **Then** an additional "Sponsorship Details" step appears in the checkout flow before the payment step.
2. **Given** the sponsorship details step, **When** the donor fills in company name and uploads a logo, **Then** the form validates the inputs (logo file type/size, required fields) and allows proceeding.
3. **Given** a donor who has completed payment for a sponsorship package, **When** the payment is confirmed, **Then** a sponsor entry is created for the event with the provided name, logo, website, and contact details.
4. **Given** a completed sponsorship purchase, **When** any user views the event page, **Then** the sponsor's logo appears in the sponsor carousel at the designated display size.
5. **Given** a donor purchasing both a sponsorship package and a regular package, **When** they proceed to checkout, **Then** the sponsorship details step only applies to the sponsorship package and regular packages proceed without it.

---

### User Story 6 — Unregistered Donor Landing Experience (Priority: P2)

When a donor logs into the donor PWA but has no event registrations (e.g., they purchased tickets but haven't assigned one to themselves yet), the system should show them a meaningful landing page. This page displays their ticket inventory across all events with clear calls-to-action to assign tickets and register themselves. If they have no tickets at all, they are guided to browse events.

**Why this priority**: This closes a UX gap where authenticated users with no registrations would see an empty state. It keeps users engaged and guides them toward completing their event journey.

**Independent Test**: Can be tested by logging in as a user with purchased-but-unassigned tickets and verifying the landing experience shows ticket inventory with assignment CTAs.

**Acceptance Scenarios**:

1. **Given** an authenticated donor with purchased but unassigned tickets, **When** they log in and have no event registrations, **Then** they see a "My Tickets" dashboard showing their unassigned tickets with a CTA to assign or register.
2. **Given** an authenticated donor with no purchases and no registrations, **When** they log in, **Then** they see a welcome screen with a prompt to browse available events.
3. **Given** a donor on the "My Tickets" dashboard, **When** they click "Register Myself" on an unassigned ticket, **Then** they are taken through the self-registration flow for that event.

---

### User Story 7 — Resend Invitation & Assignment Management (Priority: P3)

A donor who has assigned tickets can manage those assignments: resend an invitation email to a guest who hasn't registered yet, cancel an assignment and reassign the ticket, or view the registration status of each assigned guest. An optional reminder can be sent to guests with pending registrations.

**Why this priority**: This is a management/convenience feature that improves the ticket assignment experience but is not critical for the core purchasing flow.

**Independent Test**: Can be tested by assigning a ticket, resending the invitation, cancelling the assignment, reassigning to someone else, and verifying each action's result.

**Acceptance Scenarios**:

1. **Given** a donor with an assigned but unregistered ticket, **When** they click "Resend Invitation", **Then** a new invitation email is sent to the assigned guest.
2. **Given** a donor with an assigned but unregistered ticket, **When** they click "Cancel Assignment", **Then** the ticket returns to "Unassigned" status and is available for reassignment.
3. **Given** a donor viewing assigned tickets, **When** they view the assignment details, **Then** they can see: guest name, email, assignment date, invitation sent date, and registration status (pending/completed).

---

### User Story 8 — Purchase History & Receipts (Priority: P3)

A donor can view their purchase history showing all ticket orders across events. Each order shows the packages purchased, quantities, promo codes applied, total amount paid, and payment status. They can download a PDF receipt for any completed purchase.

**Why this priority**: Purchase history provides financial transparency and is needed for record-keeping, but is not essential for the initial ticket purchasing flow.

**Independent Test**: Can be tested by making a purchase, navigating to purchase history, and downloading the receipt PDF.

**Acceptance Scenarios**:

1. **Given** a donor with completed purchases, **When** they navigate to purchase history, **Then** they see a chronological list of orders showing event name, date purchased, packages, quantities, and total paid.
2. **Given** a donor viewing a specific order, **When** they click "Download Receipt", **Then** a PDF receipt is downloaded containing the itemized purchase details.

---

### Edge Cases

- What happens when a donor tries to purchase tickets for an event whose ticket sales window has closed? → The event page should show that ticket sales are closed and disable the purchase CTA.
- What happens when a package exceeds its configured quantity limit? → The system permits the purchase (soft oversell) and flags the package as oversold for event coordinator review and manual resolution.
- What happens when a donor assigns a ticket to an email address that already has an account? → The invitation email should prompt them to sign in (not create a new account) and complete event registration.
- What happens if the same person is assigned tickets by multiple purchasers for the same event? → The system should allow it — the guest registers once, and subsequent ticket assignments show as "Already Registered."
- What happens when a donor tries to assign more tickets than they have available? → The assign button should only be available for unassigned tickets; the system should not allow over-assignment.
- What happens when a guest clicks an invitation link after the event has already occurred? → The system should display a message that the event has passed and registration is no longer available.
- How are refunds handled for assigned/registered tickets? → Out of scope for this feature; refund flows are handled by the payment processing feature (033). However, if a refund occurs, ticket assignments should be revoked and guests notified.
- What happens when a registered guest cancels their registration? → The ticket returns to "Unassigned" in the purchaser's inventory. The guest loses access to the event in the donor PWA. The purchaser is notified and can reassign the ticket.
- What happens to the cart if the user's session expires? → Cart state is maintained in the browser; if the session expires, the user re-authenticates and the cart persists (stored in browser local storage).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display event details and available ticket packages to unauthenticated visitors on the public event page.
- **FR-002**: System MUST require authentication before allowing ticket purchases, with a seamless return to the ticket page after sign-in or account creation.
- **FR-003**: System MUST allow authenticated donors to add multiple ticket packages to a shopping cart with configurable quantities per package.
- **FR-004**: System MUST enforce per-package total quantity limits and the per-event per-donor ticket cap (FR-028) as configured by the event coordinator.
- **FR-028**: System MUST enforce a configurable per-event maximum tickets-per-donor limit, set by the event coordinator with a reasonable default (e.g., 20). The cart MUST prevent adding tickets beyond this cap.
- **FR-005**: System MUST allow ticket purchases to proceed even when inventory is nominally exhausted (soft oversell). The system SHOULD display a warning to event coordinators when packages exceed their configured quantity limit, enabling manual resolution (e.g., upgrading guests, issuing refunds).
- **FR-006**: System MUST support promo code application at checkout, displaying the discount and updated total before payment.
- **FR-007**: System MUST integrate with the payment gateway (hosted payment form) for card entry so that card data never touches the application servers.
- **FR-008**: System MUST use a payment stub that simulates successful payment while the live payment gateway integration is pending.
- **FR-009**: System MUST generate a ticket purchase record and individual assigned ticket entries (with unique QR codes) upon successful payment.
- **FR-010**: System MUST send an order confirmation email with receipt upon successful purchase.
- **FR-011**: System MUST provide a ticket inventory view showing all purchased tickets grouped by event, with assignment status for each ticket.
- **FR-012**: System MUST allow donors to assign individual tickets to guests by entering a name and email address.
- **FR-013**: System MUST allow donors to assign a ticket to themselves, triggering an inline self-registration flow.
- **FR-014**: System MUST allow donors to send email invitations to assigned guests containing event details and a registration link.
- **FR-015**: System MUST allow invited guests to create an account and register for the event through the invitation link, including answering any custom ticket option questions configured for the package (e.g., "T-shirt size", "Dietary restrictions").
- **FR-016**: System MUST grant registered guests full access to event features (event home page, auction, seating) in the donor PWA.
- **FR-017**: System MUST collect sponsorship details (company name, logo, website) during checkout when a sponsorship-flagged package is purchased.
- **FR-018**: System MUST create a sponsor entry for the event upon successful sponsorship package purchase.
- **FR-019**: System MUST allow ticket reassignment when the assigned guest has not yet completed registration, and MUST prevent reassignment once the guest has registered (unless the registration is first cancelled per FR-026/FR-027).
- **FR-026**: System MUST allow registered guests to cancel their own event registration, which returns the ticket to the purchaser's unassigned pool for reassignment.
- **FR-027**: System MUST allow event coordinators to cancel a guest's registration via the admin interface, which returns the ticket to the purchaser's unassigned pool for reassignment.
- **FR-021**: System MUST show authenticated donors with no event registrations a landing page displaying their ticket inventory with assignment CTAs, or a prompt to browse events if they have no tickets.
- **FR-022**: System MUST allow donors to resend invitation emails to guests with pending registrations.
- **FR-023**: System MUST allow donors to view their purchase history with receipt download capability.
- **FR-024**: System MUST persist the shopping cart in the browser so it survives page refreshes and session re-authentication.
- **FR-025**: System MUST display a sold-out indicator on packages that have reached their configured quantity limit, but MUST NOT hard-block purchases (soft oversell policy per FR-005).

### Key Entities

- **Ticket Package**: A purchasable bundle of event seats with a name, description, price, quantity limit, seats per package, optional sponsorship flag, and optional custom questions. Configured by event coordinators in the admin interface (already exists).
- **Shopping Cart**: A client-side collection of ticket package selections with quantities, maintained per event per user session. Not persisted server-side; stored in browser local storage.
- **Ticket Purchase**: A completed order record linking a donor, event, and one or more packages with quantities, payment details, promo code applied, and total amount paid (already exists).
- **Assigned Ticket**: An individual ticket (seat) within a purchase, identified by a unique ticket number and QR code. Can be in one of three states: unassigned, assigned (pending registration), or registered (already exists).
- **Ticket Assignment**: The association between an assigned ticket and a guest, including guest name, email, invitation status, and registration status.
- **Ticket Invitation**: An email sent to an assigned guest containing event details, a personalized message, and a registration link with a unique token.
- **Sponsor Entry**: A record of sponsorship details (company name, logo, website, contact info) linked to an event, created when a sponsorship package is purchased (already exists).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can view event details and ticket packages within 3 seconds of landing on the event page.
- **SC-002**: An authenticated donor can complete the full ticket purchase flow (browse → cart → checkout → confirmation) in under 5 minutes.
- **SC-003**: 95% of ticket assignment operations (entering guest name/email and confirming) complete in under 30 seconds.
- **SC-004**: Invited guests can complete the full registration flow (click link → create account → register → see event) in under 4 minutes.
- **SC-005**: The system allows soft overselling and surfaces oversold packages to event coordinators within 1 page refresh, enabling timely manual resolution.
- **SC-006**: Sponsorship package purchases result in the sponsor appearing on the event page within 1 page refresh.
- **SC-007**: Donors can access their ticket inventory and assignment status from any page in the donor PWA within 2 taps/clicks.
- **SC-008**: 90% of users can complete their first ticket purchase without external help or documentation.
- **SC-009**: The system permits soft overselling and provides coordinators with clear visibility into oversold packages so they can resolve conflicts before the event.
- **SC-010**: All purchase and assignment actions produce an auditable record that can be reviewed by event coordinators.

## Assumptions

- The existing ticket package management (feature 015) is complete and event coordinators have already configured packages.
- The payment gateway integration (feature 033) provides either a working hosted payment form or a functional stub that simulates successful payment.
- The existing registration system (feature 010) handles guest registration, meal selection, and guest list management.
- The existing sponsor model (feature 007) supports all fields needed for sponsorship info collection (logo upload, website, contact details).
- Cart state is stored client-side (browser local storage) and is not synchronized across devices.
- Email delivery infrastructure is operational for sending invitations and confirmations.
- Each ticket in a multi-seat package is individually assignable (e.g., buying a "Table of 8" package yields 8 individually assignable tickets).
- A donor can only purchase tickets for one event at a time (cart is per-event, not cross-event).
- Refund handling for assigned/registered tickets is out of scope — managed by feature 033 (payment processing).
- The ticket sales window (open/close dates) is managed by event coordinators in the admin interface.
