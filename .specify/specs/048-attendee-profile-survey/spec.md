# Feature Specification: Attendee Profile Survey

**Feature Branch**: `048-attendee-profile-survey`
**Created**: 2026-06-01
**Status**: Draft
**Input**: User description: "attendee-profile-survey — A configurable survey to gather information about each attendee at registration to help the NPO better understand what kind of potential donor they are. A large modal prompts attendees to complete the survey in exchange for a configurable discount on their event checkout. NPO admins configure questions dynamically in a dedicated Survey page in the admin PWA. Responses are recorded and displayed as columns on the donor dashboard. Default questions covering mission priorities, motivation, giving preferences, impact messaging, follow-up interest, prior support, other NPO involvement, and leadership gift openness. Four donor categories: Impact Driven, Heart Driven, Community Driven, Participation Driven. These are added as donor labels with easy assignment from the donor dashboard."

## Clarifications

### Session 2026-06-01

- Q: What checkout charges does the survey discount apply to? → A: Event-night charges only (auction wins + paddle raise/donations + buy-now purchases; excludes pre-purchased ticket packages).
- Q: Do survey responses require special privacy treatment or restricted role visibility? → A: No special treatment — covered by existing platform consent; survey response columns are visible to all roles that can already access the Donor Dashboard.
- Q: Can multiple donor category labels be auto-suggested from a single survey submission? → A: Yes — all labels whose matching criteria are met above a minimum threshold are simultaneously auto-suggested; admins confirm or dismiss each independently.
- Q: What happens when a question's option text is edited after responses have already been collected? → A: Free edits are always allowed; stored answers preserve the verbatim option text at the time the attendee responded — the dashboard always shows what the attendee actually saw and selected, regardless of subsequent edits.
- Q: Can admins copy a survey configuration from a prior event when setting up a new event? → A: Yes — copy on demand. Admin can optionally initialize a new event's survey by copying any existing event's survey configuration (questions + prompt text). The discount amount resets to $0 for the new event and must be set explicitly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Attendee Completes Profile Survey at Event Sign-In (Priority: P1)

An attendee opens the Donor PWA and navigates to their event for the first time. A large, full-screen modal immediately appears before they can interact with the event. The modal displays a personalized prompt configured by the NPO (e.g., "Tell us about yourself to earn $20 off your event checkout") along with a short series of questions about the attendee's motivations, interests, and connection to the cause. Each question presents a set of labeled options to choose from. The attendee selects an answer for each question and submits the survey. The modal closes and they proceed into the event experience. At checkout, the configured discount is automatically applied to their total.

**Why this priority**: This is the core end-to-end value delivery: collecting donor profile data in exchange for an incentive. Everything else — configuration, dashboards, labels — only has value if attendees actually complete surveys. The incentive-driven completion flow is the feature's foundation.

**Independent Test**: Can be fully tested by configuring a survey with questions and a $20 discount, logging into the donor PWA as a registered attendee, verifying the modal appears with the correct prompt and questions, submitting answers, then verifying the discount appears at checkout. Delivers standalone value.

**Acceptance Scenarios**:

1. **Given** an event has an active survey configured with a prompt and discount, **When** a registered attendee opens the event in the Donor PWA for the first time, **Then** a full-screen modal appears immediately displaying the configured prompt message and all survey questions.
2. **Given** the survey modal is open, **When** the attendee selects an answer for each question and submits, **Then** the modal closes, their responses are saved, and they are taken into the event.
3. **Given** a completed survey, **When** the attendee reaches the event checkout, **Then** the configured discount amount is automatically applied to their total with a note indicating it was earned by completing the profile survey.
4. **Given** the survey modal is open, **When** the attendee taps "Skip" or dismisses the modal, **Then** the modal closes, no responses are recorded, and no discount is applied at checkout.
5. **Given** an attendee who already completed the survey, **When** they sign into the event again on a subsequent visit, **Then** the survey modal does NOT appear again.
6. **Given** an attendee who previously skipped the survey, **When** they sign into the event again, **Then** the survey modal does NOT appear again (skip is treated as a final decision for that event).

---

### User Story 2 — NPO Admin Configures Event Survey (Priority: P1)

An NPO Admin navigates to the "Survey" section within an event in the admin PWA. They see the survey's current configuration: on/off toggle, the modal prompt text, the checkout discount amount, and the ordered list of questions. The system pre-populates a default set of 8 questions when the survey is first created. The admin edits the prompt text to match their NPO's voice, sets the discount to $20, and reviews the default questions. They remove two questions that aren't relevant, reorder the remaining ones, and add a custom question specific to their mission. They toggle the survey to active and save. The survey is now live for their event.

**Why this priority**: Without the ability to configure the survey, no attendee data can be collected. Configuration is a prerequisite for all other user stories.

**Independent Test**: Can be fully tested by opening the Survey page in admin, creating/editing a survey configuration, adding/removing/reordering questions, saving, and confirming the survey is visible and correct on the attendee-facing event page. Delivers complete standalone value.

**Acceptance Scenarios**:

1. **Given** an event with no survey configured, **When** the admin opens the Survey page for that event, **Then** the system presents a new survey setup form with a choice to start from the 8 default questions or copy the configuration from an existing event within the same NPO.
2. **Given** an existing survey configuration, **When** the admin edits the prompt text and saves, **Then** the updated prompt text appears in the attendee-facing modal immediately.
3. **Given** the survey question list, **When** the admin adds a new custom question with custom options, **Then** the new question appears in the ordered list and is immediately included in the attendee survey.
4. **Given** the survey question list, **When** the admin drags a question to reorder it, **Then** attendees see the questions in the updated order.
5. **Given** the survey question list, **When** the admin deletes a question, **Then** it is removed from all future survey presentations (existing responses for that question are preserved but no longer collected).
6. **Given** a survey with the active toggle off, **When** an attendee opens the event in the Donor PWA, **Then** the survey modal does NOT appear.
7. **Given** a survey with discount set to $0, **When** an attendee completes the survey, **Then** no discount is applied but responses are still recorded.

---

### User Story 3 — Admin Reviews Survey Responses on Donor Dashboard (Priority: P2)

An NPO Admin opens the Donor Dashboard and sees the attendee list now includes additional columns for each survey question. For each donor row, their answer to each survey question is displayed inline. The admin can sort or filter the list by a specific answer — for example, filtering to show only attendees who indicated they are "open to being approached about a leadership or matching gift." This makes it easy to identify segments of the audience for targeted appeals during the event.

**Why this priority**: Recording responses is only actionable if admins can see them. This story closes the data loop by surfacing collected insights where decisions are made — the donor dashboard.

**Independent Test**: Can be fully tested by submitting survey responses for multiple test attendees, opening the Donor Dashboard, and verifying that each attendee row shows the correct answers in dedicated survey columns. Delivers standalone value as an insight tool.

**Acceptance Scenarios**:

1. **Given** attendees have submitted survey responses, **When** an admin opens the Donor Dashboard, **Then** each survey question appears as a column header and each donor row displays that donor's selected answer (or blank if they skipped).
2. **Given** a survey question column is displayed, **When** the admin clicks the column header to sort, **Then** donors are sorted alphabetically by their answer to that question.
3. **Given** a survey question column is displayed, **When** the admin filters by a specific answer value, **Then** only donors who selected that answer are shown.
4. **Given** a survey has been modified after responses were collected, **When** viewing the Donor Dashboard, **Then** existing responses remain visible and new/removed question columns are reflected accordingly.

---

### User Story 4 — Admin Applies Donor Category Labels (Priority: P2)

An NPO Admin is reviewing attendees on the Donor Dashboard. They notice that several donors answered the survey in ways consistent with the "Impact Driven" category — they chose "measurable impact" as their motivation and "Fund a proven program" as most compelling. The system has already auto-suggested the "Impact Driven" label on those donors based on their answers. The admin confirms the auto-suggestion with a single click. For another donor who skipped the survey, the admin manually assigns the "Community Driven" label based on their prior knowledge of the donor. Labels appear as colored tags on each donor row and are visible on the individual donor profile.

**Why this priority**: Labels transform raw survey data into actionable donor segments. They enable targeted messaging, table assignments, and fundraising appeals — core value for NPOs.

**Independent Test**: Can be fully tested by completing surveys for test attendees, verifying auto-suggested labels appear, confirming/rejecting suggestions, manually applying labels to label-less donors, and verifying labels persist on the donor profile. Delivers standalone segmentation value.

**Acceptance Scenarios**:

1. **Given** an attendee's survey responses match the criteria for a donor category, **When** viewing that attendee on the Donor Dashboard, **Then** the corresponding label is displayed as a suggested (unconfirmed) tag on their row.
2. **Given** an auto-suggested label on a donor row, **When** the admin clicks to confirm the label, **Then** the label becomes confirmed and the suggestion indicator is removed.
3. **Given** a donor with no survey response, **When** the admin manually applies a label from the donor row or donor profile, **Then** the label is saved and appears as a confirmed tag immediately.
4. **Given** a donor has one or more confirmed labels, **When** the admin removes a label, **Then** the label is removed and no longer shown for that donor.
5. **Given** multiple donors on the Donor Dashboard, **When** the admin filters by a specific label (e.g., "Heart Driven"), **Then** only donors who have that confirmed label applied are shown.
6. **Given** the four default labels are defined (Impact Driven, Heart Driven, Community Driven, Participation Driven), **When** manually applying labels, **Then** all four defaults are available in a dropdown along with any custom labels the NPO has created.

---

### User Story 5 — Checkout Discount Applied for Survey Completion (Priority: P3)

At the end of the event, an attendee who completed the survey proceeds to checkout for their auction wins and paddle raise donations. The checkout summary automatically shows the survey completion discount as a line-item deduction (e.g., "−$20 Profile Survey Discount"). The final total reflects the reduced amount. An attendee who skipped the survey does not see this deduction. The NPO admin can see which checkouts included a survey discount when reviewing event financials.

**Why this priority**: The discount is the incentive mechanism that drives survey completion. Without it, completion rates would likely be lower. However, it is a supporting feature — the core value (data collection) already exists in Stories 1–4. This story ensures the incentive is correctly honored at checkout.

**Independent Test**: Can be fully tested by creating two test attendee accounts — one who completes the survey and one who skips — then advancing both to checkout and verifying the discount appears on the completer's checkout and not on the skipper's.

**Acceptance Scenarios**:

1. **Given** a survey with a $20 discount and an attendee who completed it, **When** the attendee reaches event checkout, **Then** a "Profile Survey Discount" line item appears showing −$20, and the total is reduced accordingly.
2. **Given** an attendee who skipped the survey, **When** they reach event checkout, **Then** no survey discount line item appears and the total is unaffected.
3. **Given** a survey discount of $0, **When** any attendee reaches checkout, **Then** no survey discount line item is displayed regardless of whether they completed the survey.
4. **Given** a checkout with a survey discount applied, **When** an admin views event financials or checkout records, **Then** the survey discount is visible as a separate identified deduction.

---

### Edge Cases

- What happens if an attendee partially completes the survey (closes mid-way)? Their partial responses are discarded, the survey reappears next time they open the event (within the same session visit only — once they leave and return, the survey shows again unless they fully submitted or explicitly skipped).
- What happens if the NPO reduces the discount amount after some attendees have already completed the survey? Attendees who completed before the change retain the original discount they were shown; new completions receive the updated amount.
- What happens if the NPO disables the survey after responses have been collected? Existing responses are preserved and still visible on the Donor Dashboard, but the modal no longer appears for new attendees.
- What happens if a question's option text is edited after responses have been collected? Existing answers are unaffected — each stored answer preserves the verbatim text the attendee saw at submission time. The Donor Dashboard shows the attendee's original answer text even if the current option wording has changed.
- What happens if a question is deleted after some attendees have already answered it? Existing answers to that question are preserved in the database and shown in the Donor Dashboard under the original question text (marked as removed), but the question is no longer presented to new respondents.
- What happens if an attendee's event-night checkout total (auction wins + paddle raise/donations + buy-now) is less than the survey discount? The discount reduces the event-night total to $0; no negative balance or cash payout is given, and it does not apply to pre-purchased ticket charges.
- What if a donor attends multiple events for the same NPO? Surveys are per-event; a donor may complete separate surveys for different events. Labels are NPO-scoped and persist across events.

## Requirements *(mandatory)*

### Functional Requirements

**Survey Configuration (Admin)**

- **FR-001**: NPO Admins MUST be able to access a dedicated "Survey" configuration page within each event in the admin PWA.
- **FR-002**: The Survey page MUST allow admins to enable or disable the survey for the event via a toggle, with the survey inactive by default for new events.
- **FR-003**: Admins MUST be able to set the attendee-facing modal prompt text (up to 280 characters) with a live preview of how it will appear to attendees.
- **FR-004**: Admins MUST be able to set a checkout discount amount (as a whole-dollar value, minimum $0) that is awarded to attendees who complete the survey.
- **FR-005**: When a survey is first created for an event, the system MUST pre-populate it with the 8 default questions and their default answer options.
- **FR-006**: Admins MUST be able to add new custom questions with a question text and a custom set of answer options (minimum 2 options, maximum 10 options per question).
- **FR-007**: Admins MUST be able to edit existing questions at any time, including question text and any answer option text, even after responses have been collected. Stored responses are never retroactively altered — each recorded answer preserves the exact option text the attendee saw at the time of submission.
- **FR-008**: Admins MUST be able to delete individual questions from the survey.
- **FR-009**: Admins MUST be able to reorder questions via drag-and-drop or up/down controls.
- **FR-010**: All survey configuration changes MUST be saved explicitly (not auto-saved) and take effect for all future attendee survey presentations immediately upon save.
- **FR-034**: When creating a survey for a new event, admins MUST have the option to copy the survey configuration (questions, question options, and prompt text) from any existing event within the same NPO. The discount amount MUST reset to $0 for the copied survey and must be set explicitly for the new event. The copy is a snapshot — subsequent changes to the source event's survey do not affect the new event's survey.

**Attendee Survey Experience (Donor PWA)**

- **FR-011**: When a registered attendee opens their event in the Donor PWA for the first time and an active survey is configured, the system MUST display a full-screen modal before allowing access to the event content.
- **FR-012**: The survey modal MUST display the NPO's configured prompt text prominently at the top.
- **FR-013**: Each survey question MUST be presented as a single-choice selection with all configured options visible (radio-button style selection).
- **FR-014**: The survey modal MUST include a "Skip" option that dismisses the modal without recording any responses and without applying a discount.
- **FR-015**: Upon survey submission, the system MUST record the attendee's selected answer for each question linked to their registration and the event.
- **FR-016**: Once an attendee has either submitted or explicitly skipped the survey for a given event, the modal MUST NOT be shown again for that attendee for that event.
- **FR-017**: The survey modal MUST NOT appear for attendees on events where the survey is inactive or has no questions configured.

**Checkout Discount**

- **FR-018**: When an attendee who completed the survey (not skipped) proceeds to event checkout, the system MUST automatically apply the configured discount amount as a named deduction ("Profile Survey Discount") against the event-night charges total (auction wins + paddle raise/donations + buy-now purchases). Pre-purchased ticket packages are excluded from this discount.
- **FR-019**: The survey discount MUST NOT be applied for attendees who skipped the survey.
- **FR-020**: If the checkout total before discount is less than the discount amount, the checkout total MUST be floored at $0 (no negative totals or refunds).

**Donor Dashboard Integration**

- **FR-021**: The Donor Dashboard MUST display each active survey question as an additional column, showing each attendee's submitted answer (or empty if skipped/not yet completed). Survey response columns are visible to all roles that can access the Donor Dashboard, with no additional access restrictions beyond standard dashboard permissions.
- **FR-022**: Admin users MUST be able to sort the donor list by any survey answer column.
- **FR-023**: Admin users MUST be able to filter the donor list by a specific answer value within any survey question column.

**Donor Labels**

- **FR-024**: The system MUST provide four default donor category labels available to all NPOs: "Impact Driven," "Heart Driven," "Community Driven," and "Participation Driven."
- **FR-025**: NPO Admins MUST be able to create custom donor labels in addition to the four defaults.
- **FR-026**: When an attendee's survey responses match one or more category's criteria above a minimum threshold, the system MUST auto-suggest all matching labels as unconfirmed suggestions on that donor's record. Multiple labels may be suggested simultaneously from a single survey submission.
- **FR-027**: The matching criteria for auto-suggestions MUST be: Impact Driven (chose measurable impact, program outcomes, or "Fund a proven program"); Heart Driven (chose personal connection, compassion, faith/values, or family stories); Community Driven (chose community, leadership, table participation, or joining others); Participation Driven (chose bidding, games, events, or fun experience).
- **FR-028**: Admins MUST be able to confirm or dismiss auto-suggested labels from the Donor Dashboard with a single interaction.
- **FR-029**: Admins MUST be able to manually apply any available label to any donor directly from the Donor Dashboard or donor profile, regardless of survey completion status.
- **FR-030**: Admins MUST be able to remove any label (confirmed or manually applied) from a donor.
- **FR-031**: Donor labels MUST be visible as colored tags on each donor's row in the Donor Dashboard and on the individual donor profile view.
- **FR-032**: Admins MUST be able to filter the Donor Dashboard by one or more donor labels.
- **FR-033**: Donor labels MUST be NPO-scoped — labels assigned to a donor persist across all events for that NPO.

### Key Entities

- **Event Survey Config**: Belongs to one event. Holds the active/inactive flag, the attendee-facing prompt text, and the checkout discount amount. A single event has at most one survey config.
- **Survey Question**: Belongs to one Event Survey Config. Holds the question text, display order, and whether it was a default or custom question. Can be marked as deleted while preserving historical references.
- **Survey Question Option**: Belongs to one Survey Question. Holds the option text and display order. Each question has between 2 and 10 options.
- **Survey Response**: Belongs to one attendee registration and one Event Survey Config. Records whether the attendee completed or skipped the survey, and the timestamp. One response per attendee per event.
- **Survey Answer**: Belongs to one Survey Response and one Survey Question. Records both a reference to the option that was selected AND a verbatim snapshot of the option text at the time of submission, so that later edits to question options do not alter historical responses. No Survey Answer exists for skipped surveys.
- **Donor Label**: Belongs to one NPO. Holds the label name and whether it is a system default or custom. The four system defaults are seeded for all NPOs.
- **Donor Label Assignment**: Links one Donor to one Donor Label within an NPO context. Holds whether the label is confirmed or auto-suggested, and the source (survey-suggested or manually applied).

## Assumptions

- Survey questions are single-choice only (radio button style) — multi-select questions are out of scope for this feature based on the provided default questions.
- The checkout discount is a flat dollar amount, not a percentage.
- The survey modal appears when the attendee first accesses their event page in the Donor PWA after a survey is activated; it does not appear during the initial ticket-purchase/registration flow.
- Donor labels are NPO-scoped and are not tied to a specific event — the same label (e.g., "Impact Driven") can be applied to a donor who attended multiple events for the same NPO.
- A donor may receive one or more auto-suggested labels per survey submission — all categories whose matching criteria are met above a minimum threshold are suggested simultaneously. Admins confirm or dismiss each suggestion independently.
- The donor dashboard referenced is the admin PWA Donor Dashboard (feature 039), which is being extended with survey columns and label support.
- Survey configuration is always within the context of a specific event. There is no persistent NPO-level template, but admins can copy any existing event's survey configuration to initialize a new event's survey (questions + prompt; discount resets to $0).
- All four default label names are always available in all NPOs and cannot be deleted (only custom labels can be deleted).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Attendees can complete the survey in under 2 minutes from when the modal appears to successful submission.
- **SC-002**: NPO Admins can configure a complete survey (prompt, discount, question set) in under 5 minutes from opening the Survey page for the first time.
- **SC-003**: Survey responses appear on the Donor Dashboard within 30 seconds of submission, without requiring a manual page refresh.
- **SC-004**: At least 70% of attendees who are shown the survey modal complete it (rather than skipping), validated across pilot events with an active discount incentive.
- **SC-005**: Admins can apply or confirm a donor category label in a single interaction (one click or tap) from the Donor Dashboard.
- **SC-006**: The checkout discount is applied correctly (or correctly omitted) for 100% of checkout sessions — no manual corrections required.
- **SC-007**: Admins can filter the Donor Dashboard to a specific survey answer or label and see results in under 3 seconds for events with up to 500 attendees.
