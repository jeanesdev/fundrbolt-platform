# Manual Testing Guide — 048 Attendee Profile Survey

Use this guide to verify the feature end-to-end before calling it complete.

## Prerequisites

- Local dev environment running: `make dev-fullstack` (or `make b` + `make f` in separate terminals)
- Database migrated: `make migrate`
- At least one NPO, one Event (published), and one Donor user registered for that event
- Admin user with NPO Admin or Super Admin role

---

## 1. Admin — Survey Configuration Page

### 1a. Navigate to the Survey page
1. Log in as NPO Admin → open an event → click **Survey** in the event sidebar nav
2. **Expected**: Survey page loads with a **disabled** toggle ("Survey is inactive"), 8 pre-populated default questions, and a config form

### 1b. Inspect default questions
- Verify the 8 default questions are present (Mission priority, Motivation, How to help, Compelling message, Impact updates, Prior support, Other fundraisers, Leadership gift)
- Each question should have at least 2 answer options

### 1c. Edit the survey config
1. Change the **Modal prompt title** (e.g. "Tell us about yourself!")
2. Change the **Modal prompt body** (max 280 chars — verify character counter appears)
3. Set **Discount amount** to `20` (dollars)
4. Click **Save** (not auto-saved)
5. Reload the page — **Expected**: changes persisted

### 1d. Add a new question
1. Click **Add Question**
2. Enter question text and at least 2 options
3. Click **Save** on the question
4. **Expected**: new question appears in the list with correct display order

### 1e. Edit an existing question
1. Click Edit on a question → change text or add an option → Save
2. **Expected**: changes reflected immediately in the list

### 1f. Delete a question
1. Delete a non-default question
2. **Expected**: question removed; no 409 error (deletion always allowed)

### 1g. Reset to defaults
1. Delete several questions, then click **Reset to Defaults**
2. **Expected**: 8 original default questions restored; custom questions cleared

### 1h. Copy survey from another event
1. Create a second event and configure a different survey
2. On the first event's Survey page, click **Copy from Event** and pick the second event
3. **Expected**: questions from the second event replace those on the first; discount resets to $0

### 1i. Activate the survey
1. Toggle the survey to **Active**
2. **Expected**: toggle turns on; donors will now be shown the survey

---

## 2. Donor PWA — Survey Modal

### 2a. Modal appears on first visit
1. Log in as a Donor registered for the event with an active survey
2. Navigate to the event home page
3. **Expected**: survey modal opens automatically (full-screen, no backdrop click to close)

### 2b. Modal content
- Verify the title/body match what was set in admin
- Verify the discount incentive banner shows the correct dollar amount (e.g. "Complete this survey to earn $20.00 off checkout")
- Verify all active questions and their options are displayed
- **Expected**: inactive questions do NOT appear

### 2c. Cannot dismiss via Escape or outside click
1. Press **Escape** — modal should stay open
2. Click outside the modal content — modal should stay open
3. **Expected**: only "Skip for now" and "Submit survey" buttons can close the modal

### 2d. Answer tracking
1. Answer some (but not all) questions
2. Verify the "X of Y answered" counter updates correctly
3. Verify **Submit survey** is disabled until all questions are answered

### 2e. Skip the survey
1. Click **Skip for now**
2. **Expected**: modal closes; `SurveyResponse` with `status=skipped` created
3. Refresh / navigate back — **Expected**: modal does NOT reappear (already skipped)

### 2f. Complete the survey
1. Log in as a *different* (fresh) donor or clear the skip by resetting the DB
2. Answer all questions and click **Submit survey**
3. **Expected**: modal closes; toast or silent success
4. Refresh — **Expected**: modal does NOT reappear (already completed)

### 2g. Partial completion reopens on next visit
1. Start answering but navigate away (close the browser tab) without submitting or skipping
2. Revisit the event — **Expected**: modal reappears with blank state (no `SurveyResponse` was created)

---

## 3. Checkout — Survey Discount Line Item

### 3a. Discount applied
1. As a donor who **completed** the survey (not skipped), proceed to checkout
2. **Expected**: a "Profile Survey Discount" line item appears with a negative amount (e.g. −$20.00)
3. Verify the subtotal = (sum of positive items) − discount (never negative)

### 3b. Discount capped to positive items
1. Set the survey discount to $100 in admin
2. As a donor with only $5 of event-night charges and a completed survey, open checkout
3. **Expected**: discount shown as −$5.00 (capped, not −$100.00); subtotal = $0.00

### 3c. Skipped survey — no discount
1. As a donor who **skipped** the survey, open checkout
2. **Expected**: no "Profile Survey Discount" line item

### 3d. No survey at all — no discount
1. As a donor who hasn't seen the survey (event has survey disabled), open checkout
2. **Expected**: no discount line item

---

## 4. Admin — Donor Dashboard: Label Suggestions

### 4a. Verify auto-suggested labels
1. After a donor completes the survey (section 2f), go to **Donor Dashboard → Leaderboard**
2. Find that donor — click to open their profile panel
3. **Expected**: one or more suggested labels appear (e.g. "Impact Driven", "Heart Driven") with a **Confirm** and **Dismiss** badge/button

### 4b. Confirm a label suggestion
1. Click **Confirm** on a suggested label
2. **Expected**: label moves to confirmed state (no longer shows as a suggestion)
3. **Expected**: confirmed label now appears in the donor's leaderboard row

### 4c. Dismiss a label suggestion
1. Click **Dismiss** on a suggested label
2. **Expected**: label disappears from the suggestions list; donor no longer has that label
3. Attempt to dismiss via the suggestion endpoint on a *confirmed* label
4. **Expected**: 409 Conflict response (cannot dismiss confirmed labels via suggestion endpoint)

### 4d. Bulk confirm-all
1. Add multiple suggested labels (or submit a survey that triggers multiple suggestions)
2. Click **Confirm All** in the profile panel
3. **Expected**: all suggestions become confirmed labels in one action

### 4e. Manually add a label
1. Open a donor's profile panel → click **Add Label** picker
2. Select any of the 4 system-default category labels or a custom label
3. **Expected**: label added as a manual label (not flagged as a suggestion)

### 4f. Remove a label
1. Click the × on a confirmed/manual label
2. **Expected**: label removed from the donor

---

## 5. Admin — Donor Dashboard: Survey Answers Tab

### 5a. Navigate to Survey Answers tab
1. On **Donor Dashboard**, click the **Survey Answers** tab
2. **Expected**: table loads with one row per donor who completed the survey
3. Columns: donor name + one column per active survey question

### 5b. Sort by answer column
1. Click a question column header to sort ascending/descending
2. **Expected**: rows reorder correctly

### 5c. Filter by label
1. Use the **Label filter** on the Leaderboard tab (or Survey Answers tab if applicable)
2. Select "Impact Driven" — **Expected**: only donors with that label shown

---

## 6. System Default Labels

### 6a. Labels exist on new NPO
1. Create a brand-new NPO (via admin)
2. Navigate to the NPO's **Donor Labels** settings
3. **Expected**: 4 labels pre-exist: **Impact Driven**, **Heart Driven**, **Community Driven**, **Participation Driven** — marked as system defaults

### 6b. System labels cannot be deleted
1. Attempt to delete a system-default label
2. **Expected**: delete is rejected or the label is protected (depending on implementation)

---

## 7. Edge Cases

| Scenario | Expected Outcome |
|---|---|
| Survey with 0 active questions | `should_show=false`; modal never appears |
| Survey config not yet created for event | First admin visit auto-seeds 8 defaults |
| Donor visits event before survey is activated | Modal does not appear |
| Donor registered for multiple events | Each event has independent survey state |
| NPO has no default labels yet (pre-migration) | Migration seeds 4 defaults for all existing NPOs |
| Admin edits a question after survey responses exist | Historical answers still display correctly (snapshot stored) |

---

## Calling the Feature Complete

The feature is ready when:

- [ ] All 7 sections above pass without errors
- [ ] Survey modal appears exactly once per donor per event (skip or complete)
- [ ] Discount line item appears in checkout with correct capped amount
- [ ] Label suggestions appear automatically and can be confirmed / dismissed individually
- [ ] Admin survey config page allows full CRUD with explicit save semantics
- [ ] Survey Answers tab in Donor Dashboard shows per-question columns
