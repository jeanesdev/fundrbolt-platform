# Quickstart & Test Scenarios: Configurable Our Cause Card Sections

**Branch**: `050-custom-sections` | **Date**: 2026-06-15

## Local Setup

```bash
# Backend: run migration once new model files exist
cd backend && poetry run alembic upgrade head

# Admin PWA
cd frontend/fundrbolt-admin && pnpm dev  # http://localhost:5173

# Donor PWA
cd frontend/donor-pwa && pnpm dev --port 5174  # http://localhost:5174
```

## Scenario 1: Create and Publish a Text Card (P1 — US1)

1. Log in as NPO Admin.
2. Navigate to an event → "Our Cause" configuration tab.
3. Click **Add Card** → select **Text** template.
4. Enter a heading and body text using the WYSIWYG editor (bold, link, bullet list).
5. Under **Appearance**: enable header, set background to `slate-50`, border to `slate-200`.
6. Click **Save Draft** — card appears in the list with a "Draft" badge.
7. Navigate to the donor PWA event page — the new card should NOT be visible yet.
8. Back in admin, click **Publish**.
9. Reload donor PWA — card appears with heading and styled body.

**Acceptance check**: Steps 7 and 9 confirm draft/publish separation (FR-016, FR-017).

## Scenario 2: Create a Slideshow Card (P1 — US1)

1. Click **Add Card** → select **Slideshow** template.
2. Add three slides:
   - Slide 1: **Image Only** — upload a JPEG.
   - Slide 2: **Text Over Image** — upload image, enter HTML overlay text.
   - Slide 3: **Text Only** — enter testimonial text.
3. Reorder slides by dragging Slide 3 to position 1.
4. Save Draft → Publish.
5. On donor PWA, verify slideshow advances through all three slides in the correct order.

**Acceptance check**: Slide variant rendering and reorder (FR-004, FR-005).

## Scenario 3: Create a Video Card (P1 — US1)

1. Click **Add Card** → select **Video** template.
2. Choose **External URL** → paste a valid HTTPS video URL.
3. Enable **Autoplay**, disable **Audio by default**.
4. Save Draft. Verify that entering an invalid URL shows a validation error.
5. Publish → confirm donor PWA plays video muted on load.

**Acceptance check**: External URL validation (FR-022, FR-023), playback settings (FR-006).

## Scenario 4: Reorder and Disable Cards (P2 — US2)

1. Create two custom cards and ensure all three built-in cards are visible in the list.
2. Drag a custom card above the Sponsors built-in section.
3. Disable the Event Details built-in card using its toggle.
4. Publish.
5. On donor PWA, confirm: custom card appears before Sponsors, Event Details is absent.

**Acceptance check**: FR-008, FR-009, FR-010, FR-011.

## Scenario 5: Manage Built-In Section Cards (P3 — US3)

1. Open cause-page config for a fresh event (built-in cards auto-seeded).
2. Verify About, Sponsors, Event Details appear in the list.
3. Move Sponsors to the bottom. Disable About. Publish.
4. Reload donor PWA — verify Sponsors is at the bottom, About is hidden.

**Acceptance check**: FR-010, FR-011.

## Scenario 6: Concurrent Edit Conflict (Edge Case)

1. Open cause-page config in two browser tabs (same admin account).
2. In Tab A, reorder two cards and Save Draft.
3. In Tab B (which has the stale version), try to reorder a different pair and Save Draft.
4. Tab B must receive a 409 Conflict response and show the conflict resolution modal.

**Acceptance check**: FR-018, FR-019.

## Scenario 7: Content Sanitisation (Security)

1. In a Text card, use the browser dev tools to inject `<script>alert(1)</script>` into the HTML field before submitting.
2. Verify the server strips the script tag — response body must not contain `<script>`.
3. Verify published donor PWA page does not execute the injected script.

**Acceptance check**: FR-020, FR-021.
