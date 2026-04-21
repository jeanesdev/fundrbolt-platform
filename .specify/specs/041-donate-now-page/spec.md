# Feature Specification: Donate Now Page

**Feature Branch**: `041-donate-now-page`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "donate-now-page"

## Overview

A standalone public donation page for each NPO, accessible at `/npo/donate-now`, that enables donors to make one-time or recurring donations with a configurable, branded experience. NPO administrators configure the page's appearance and content through the Admin PWA. The page integrates with the existing donor authentication flow and surfaces a social support wall to build community trust.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Donor Makes a One-Time Donation (Priority: P1)

A prospective donor visits the NPO's Donate Now page, selects a preset donation amount (or enters a custom amount), optionally covers processing fees, and completes the donation by sliding to confirm and authenticating.

**Why this priority**: This is the core transactional flow. Without it, the page delivers no value.

**Independent Test**: A visitor can navigate to the page, select $50, slide to donate, log in, and receive confirmation — testable end-to-end with a real or test payment.

**Acceptance Scenarios**:

1. **Given** a visitor is on the Donate Now page, **When** they tap a preset donation amount button (e.g., "$50"), **Then** a spinner/amount selector appears pre-set to that amount.
2. **Given** the amount selector is open, **When** the donor slides the "Slide to Donate" control, **Then** a second confirmation dialog appears summarising the amount and offering a "Cover processing fees" checkbox.
3. **Given** the confirmation dialog is shown, **When** the donor confirms, **Then** they are prompted to log in or create an account (same flow as the event page).
4. **Given** the donor has authenticated, **When** authentication completes, **Then** the donation is submitted and the donor sees a success state.
5. **Given** the donor taps "Custom Amount", **When** they enter a value in the amount selector, **Then** the slider label updates to reflect the entered amount.

---

### User Story 2 - Donor Sets Up a Monthly Recurring Donation (Priority: P1)

A donor selects a monthly gift option, chooses start and end dates, and completes the recurring donation flow.

**Why this priority**: Recurring donations are a primary revenue driver for NPOs and a key differentiator of this feature.

**Independent Test**: Select a preset amount, check "Make this monthly", set start/end dates, slide to donate, and confirm — the recurring schedule is recorded.

**Acceptance Scenarios**:

1. **Given** a donor has selected an amount, **When** they check "Make this gift monthly", **Then** "Starting:" and "Continue until:" date pickers appear and the slider label changes to "$(amount) Monthly".
2. **Given** a monthly gift is selected, **When** the date pickers are not filled, **Then** "Starting:" defaults to today and "Continue until:" defaults to open-ended (no end date).
3. **Given** monthly is selected, **When** the donor slides to donate and confirms, **Then** the submitted donation record includes the recurrence schedule.
4. **Given** monthly is NOT selected, **When** viewing the confirmation, **Then** no date pickers or "Monthly" indicators are visible.

---

### User Story 3 - Donor Leaves a Support Wall Message (Priority: P2)

After selecting a donation amount (before confirming), a donor writes a message for the support wall, chooses visibility settings, and their entry appears on the wall after the donation is completed.

**Why this priority**: The support wall builds social proof and encourages future donations, but does not block the core transaction.

**Independent Test**: Complete a donation with a message and verify the support wall shows the entry with correct anonymity and amount-display settings.

**Acceptance Scenarios**:

1. **Given** the donation form is open, **When** a donor types in the message box (max 200 characters), **Then** a character counter is shown and input is capped at 200 characters.
2. **Given** a donor checks "Post anonymously", **When** their entry appears on the support wall, **Then** their name is shown as "Anonymous".
3. **Given** a donor unchecks "Show donation amount", **When** their entry appears on the wall, **Then** no dollar amount is displayed alongside their message.
4. **Given** the support wall has more than 5 entries, **When** the page loads, **Then** the first 3 pages (up to 15 entries) cycle automatically and pagination controls allow manual navigation.

---

### User Story 4 - NPO Admin Configures the Donate Now Page (Priority: P1)

An NPO administrator uses the Admin PWA to set up the hero section, donation amounts with impact statements, page copy, processing fee rate, and the NPO info section, then previews the result.

**Why this priority**: Without configuration capability, the donor-facing page cannot be meaningfully personalised. This unblocks all other stories.

**Independent Test**: Admin saves a configuration (hero image, 3 donation tiers, processing fee %, info text) and the Donate Now page reflects all changes.

**Acceptance Scenarios**:

1. **Given** an admin is on the Donate Now configuration page, **When** they upload a hero image and select a transition style, **Then** a preview of the hero displays within the admin UI.
2. **Given** the admin enters a "donate plea" headline, **When** they save, **Then** the text appears as a header directly below the hero image on the donor page.
3. **Given** the admin adds a donation tier with an amount and optional impact statement, **When** they save, **Then** a button for that amount with the impact statement appears on the donor page.
4. **Given** the admin sets the processing fee percentage, **When** a donor checks "Cover processing fees" on the confirmation, **Then** the calculated fee amount is shown and added to the total.
5. **Given** the admin fills in the NPO info section (bio, contact, address, phone), **When** saved, **Then** this content displays in the designated info section below the support wall.

---

### User Story 5 - Donor Navigates from Event Page to Donate Now Page (Priority: P2)

A donor attending or browsing an NPO event clicks a "Donate Now" button on the "My Event" page and is taken to the NPO's Donate Now page.

**Why this priority**: Cross-promotion between events and the donation page increases donation conversion from an already-engaged audience.

**Independent Test**: On the event "My Event" page, tap "Donate Now" and confirm navigation to the correct NPO donate page.

**Acceptance Scenarios**:

1. **Given** a donor is on the "My Event" page for an NPO event, **When** they tap the "Donate Now" button, **Then** they are navigated to that NPO's `/npo/donate-now` page.
2. **Given** the NPO has no Donate Now page configured or it is disabled, **When** the donor is on the event page, **Then** the "Donate Now" button is not shown.

---

### Edge Cases

- What happens when a payment is declined? → An inline error message is shown on the confirmation dialog; the donor may retry or change their amount without losing their form state.
- What happens when a donor enters $0 or a negative custom amount? → The "Slide to Donate" control remains disabled until a valid amount (> $0) is entered.
- What happens if the NPO has no hero image configured? → A default branded placeholder is shown.
- What happens if the NPO has no donation tiers configured? → Only the custom amount option is shown.
- What happens if the donor dismisses the authentication prompt after sliding? → The donation is not submitted and the donor is returned to the confirmation dialog.
- What happens if an NPO has no upcoming events? → The "Upcoming Event" button is not shown.
- What happens if the support wall has fewer than 5 entries? → No pagination is shown and auto-cycling does not trigger.
- What happens when a monthly recurring end date is set in the past? → The date picker rejects past end dates with an inline validation message.
- What happens if the donor closes the browser after authentication but before final confirmation? → The donation is not submitted; no partial records are created.

## Requirements *(mandatory)*

### Functional Requirements

#### Donor-Facing Page

- **FR-001**: The page MUST be publicly accessible at a stable NPO-specific URL without requiring login.
- **FR-002**: The page MUST display a hero section with configurable media (image or video) and transition style, consistent with the event page hero.
- **FR-003**: The page MUST display a "donate plea" headline directly below the hero image as configured by the NPO admin.
- **FR-004**: The page MUST display one button per configured donation tier; each button MUST show the amount and, if configured, an impact statement.
- **FR-005**: The page MUST provide a "Custom Amount" button that opens the amount selector and allows the donor to enter any positive dollar amount.
- **FR-006**: Tapping any donation amount button or the custom amount button MUST open an amount spinner/selector (consistent with the auction item page) pre-filled with the selected amount.
- **FR-007**: The amount selector MUST allow the donor to change the amount after initial selection.
- **FR-008**: A slider control labelled with the current amount (e.g., "$50") MUST be present; for monthly gifts it MUST display "$(amount) Monthly".
- **FR-009**: Sliding the control to completion MUST trigger a second confirmation dialog before submitting.
- **FR-010**: The confirmation dialog MUST include a "Cover processing fees" checkbox showing the calculated fee amount based on the NPO-configured processing fee percentage.
- **FR-011**: The donor MUST be able to check "Make this gift monthly" to convert the donation to a recurring gift.
- **FR-012**: When "monthly" is selected, "Starting:" and "Continue until:" date pickers MUST appear; when not selected, they MUST be hidden.
- **FR-013**: "Starting:" MUST default to today's date; "Continue until:" MUST default to no end date (open-ended) unless the donor selects one.
- **FR-013a**: The recurring schedule (start date, end date, amount) MUST be passed to the payment processor at donation submission time; the platform stores these values locally for display and record-keeping only — no platform-side charge scheduling is performed.
- **FR-014**: The page MUST include a message input (max 200 characters) for a support wall post, with a visible character counter.
- **FR-015**: The page MUST include a "Post anonymously" checkbox and a "Show donation amount" checkbox controlling support wall display.
- **FR-016**: After the donor confirms on the second dialog, if they are not authenticated, the page MUST prompt them to log in or create an account using the same flow as the event page. If the donor is already authenticated, this prompt MUST be skipped and the donation submitted directly.
- **FR-017**: The donation MUST only be submitted after successful authentication and final confirmation.
- **FR-017a**: If the payment processor declines the charge, the confirmation dialog MUST remain open and display an inline error message; the donor MUST be able to retry or adjust their amount without re-entering personal information or re-authenticating.
- **FR-017b**: Upon successful donation submission, the page MUST display an inline success state (celebratory animation and thank-you message) without redirecting away; the donor MUST be able to dismiss the success state and return to the Donate Now page.
- **FR-018**: The page MUST display an NPO information section containing the NPO's bio, contact details, address, and phone number as configured by the admin.
- **FR-019**: The page MUST display a paginated support wall showing donor name (or "Anonymous"), message, donation level, and relative time (e.g., "3 days ago"); 5 entries per page. Only entries not hidden by an admin are shown.
- **FR-019a**: The Admin PWA MUST allow NPO admins to view all support wall entries for their NPO's Donate Now page and hide or restore individual entries.
- **FR-020**: The support wall MUST automatically cycle through the first 3 pages; pagination controls MUST allow manual navigation at any time.
- **FR-021**: The page MUST display a profile menu consistent with the event page.
- **FR-022**: The page MUST display a row of social media links as configured for the NPO.
- **FR-023**: If the NPO has at least one upcoming published event, an "Upcoming Event" button linking to that event's page MUST be shown; the nearest chronological event is highlighted.
- **FR-024**: A FundrBolt logo MUST be displayed at the bottom of the page.
- **FR-025**: The "My Event" page MUST include a "Donate Now" button that navigates to the NPO's Donate Now page; this button MUST only appear if the NPO has the Donate Now page enabled.

#### Admin Configuration (Admin PWA)

- **FR-026**: The Admin PWA MUST provide a Donate Now page configuration section accessible under the NPO management area.
- **FR-027**: Admins MUST be able to upload hero media, select transition styles, and preview the hero within the admin UI.
- **FR-028**: Admins MUST be able to input and save the "donate plea" headline text.
- **FR-029**: Admins MUST be able to add, edit, reorder, and remove donation tiers, each with an amount and optional impact statement.
- **FR-030**: Admins MUST be able to configure a processing fee percentage (0–100%) applied when the donor chooses to cover fees.
- **FR-031**: Admins MUST be able to enter NPO info section content (bio copy, address, phone, contact details).
- **FR-032**: Admins MUST be able to enable or disable the Donate Now page without deleting its configuration.

### Key Entities

- **DonateNowPageConfig**: NPO-level configuration storing hero media reference, transition style, donate plea text, processing fee %, NPO info copy, enabled/disabled state.
- **DonationTier**: Amount, optional impact statement text, display order. Belongs to a DonateNowPageConfig.
- **Donation**: Donor identity (or anonymous reference), amount, currency, one-time vs recurring flag, recurrence start/end dates, processing fee covered flag, submission timestamp, status.
- **SupportWallEntry**: Linked donation, display name (or "Anonymous"), message text (≤200 chars), show-amount flag, created timestamp, hidden flag (set by admin), visible flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A donor can select an amount, complete the slide-to-donate flow, authenticate, and receive donation confirmation in under 3 minutes from page load.
- **SC-002**: The support wall displays up to 5 entries per page and automatically advances through the first 3 pages without any donor interaction.
- **SC-003**: An NPO admin can fully configure the Donate Now page (hero, tiers, fee %, info copy) and publish it without requiring developer assistance.
- **SC-004**: All configured donation tiers, impact statements, and NPO info copy appear on the donor-facing page within 30 seconds of an admin saving changes.
- **SC-005**: The "Make this gift monthly" checkbox shows date pickers within a single interaction with no page reload.
- **SC-006**: The processing fee amount is calculated and displayed correctly in the confirmation dialog for 100% of donations where the checkbox is selected.
- **SC-007**: The support wall correctly applies anonymity and amount-display preferences for 100% of submitted entries.
- **SC-008**: The "Donate Now" button appears on the "My Event" event page for all NPOs with the Donate Now page enabled, and is absent for those without.

## Clarifications

### Session 2026-04-20

- Q: When a donor sets up a monthly recurring gift, what mechanism handles the subsequent monthly charges? → A: Payment processor manages recurrence (e.g., Stripe Subscriptions) — platform stores the schedule for display only; no platform-side scheduler or retry logic required in this feature.
- Q: What should the donor experience when a payment is declined at the point of donation? → A: Show inline error message on the confirmation dialog with option to retry or change amount.
- Q: If a donor is already authenticated when they slide to donate, what happens? → A: Skip the auth prompt; proceed directly to final confirmation and submit.
- Q: How are support wall messages moderated before appearing publicly? → A: NPO admin can review and hide/remove individual entries from the Admin PWA; entries appear immediately upon donation completion.
- Q: What does the donor see immediately after a successful donation is submitted? → A: Inline success message on the same page (animation, thank-you copy, return to page); no redirect.

## Assumptions

- Payment processing integration already exists in the platform from the ticket purchasing feature (036-ticket-purchasing); this feature reuses that payment flow.
- Recurring monthly donations are managed entirely by the payment processor's subscription/recurring billing feature. The platform records the donor's chosen start date, end date, and amount for display purposes only; it does not schedule, trigger, or retry charges.
- The authentication prompt after sliding uses the identical flow implemented for the event page — no new auth screens are needed.
- The amount spinner/selector is the same component used on the auction item page (024-donor-bidding-ui) — reused without modification.
- "Donation level" on the support wall refers to the tier label derived by matching the donated amount against configured tiers, or omitted for custom amounts outside any tier.
- Only one Donate Now page configuration exists per NPO, not per event.
- Hero media supports the same formats and transition options already supported on the event page hero.
- Processing fees are calculated as a simple percentage of the donation amount (e.g., 3% of $100 = $3.00).
- Social links displayed on this page come from the existing NPO social links configuration — no new social fields are needed.
- If multiple upcoming events exist for the NPO, the nearest chronological one is shown.
- The support wall shows only completed/confirmed donations (no pending entries).
- The NPO info section supports plain text only (no rich text, images, or embeds).
