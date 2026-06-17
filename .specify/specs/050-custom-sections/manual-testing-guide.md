# Manual Testing Guide: Configurable Our Cause Card Sections (Feature 050)

**Branch**: `050-custom-sections` | **Date**: 2026-06-15

## Prerequisites

```bash
# 1. Run migration
cd backend && poetry run alembic upgrade head

# 2. Start backend
cd backend && poetry run uvicorn app.main:app --reload  # http://localhost:8000

# 3. Start admin PWA
cd frontend/fundrbolt-admin && pnpm dev  # http://localhost:5173

# 4. Start donor PWA
cd frontend/donor-pwa && pnpm dev --port 5174  # http://localhost:5174
```

Log in as an NPO Admin and have at least one event ready in the system.

---

## Scenario 1: Create and Publish a Text Card ✅ MVP

**Goal**: Verify draft/publish separation (FR-016, FR-017).

1. Log in as NPO Admin → navigate to an event.
2. In the sidebar, click **"Our Cause"** (new nav item).
3. Verify the page loads with three built-in sections pre-seeded: *About*, *Sponsors*, *Event Details*.
4. Click **Add Card** → select **Text** template.
5. Enter a heading in the **Title** field and body text in the WYSIWYG editor (try bold, link, bullet list).
6. Under **Appearance**: enable header, set background to `slate-50`, border to `slate-200`.
7. Click **Save** — card should appear in the list with a **"Draft"** indicator.
8. Open the donor PWA at `http://localhost:5174` → navigate to the same event.
9. **Expected**: The new text card is NOT visible yet on the donor page.
10. Back in admin, click **Publish**.
11. Reload the donor PWA.
12. **Expected**: The text card is now visible with its heading and styled body.

---

## Scenario 2: Create a Slideshow Card ✅ MVP

**Goal**: Verify slide variant rendering and reorder (FR-004, FR-005).

1. Click **Add Card** → select **Slideshow** template.
2. Add three slides:
   - Slide 1: **Image Only** — paste an HTTPS image URL (e.g., `https://picsum.photos/800/400`) + enter alt text.
   - Slide 2: **Text Over Image** — paste image URL + enter alt text + enter overlay text.
   - Slide 3: **Text Only** — enter testimonial text in the overlay field.
3. Drag Slide 3 to position 1 using the drag handle.
4. Click **Save** → **Publish**.
5. On donor PWA, verify the slideshow shows all three slides **in the new order** (text-only first).

---

## Scenario 3: Create a Video Card ✅ MVP

**Goal**: Verify external URL validation (FR-022, FR-023) and playback settings (FR-006).

1. Click **Add Card** → select **Video** template.
2. Select **External URL** → enter `http://example.com/video.mp4` (HTTP, not HTTPS).
3. **Expected**: A validation error appears ("External media URLs must use HTTPS").
4. Change to a valid HTTPS URL (e.g., `https://www.w3schools.com/html/mov_bbb.mp4`).
5. Enable **Autoplay** toggle, disable **Audio by default**.
6. Click **Save** → **Publish**.
7. On donor PWA, verify video plays muted on load.

---

## Scenario 4: Reorder and Disable Cards ✅ P2

**Goal**: Verify FR-008, FR-009, FR-010, FR-011.

1. Ensure at least 2 custom cards and 3 built-in cards exist.
2. In the admin card list, **drag** a custom card above the *Sponsors* built-in card.
3. Toggle the **is_enabled** switch for **Event Details** to OFF.
4. Click **Publish**.
5. On donor PWA, confirm:
   - Custom card appears **before** Sponsors.
   - Event Details section is **absent**.

---

## Scenario 5: Manage Built-In Section Cards ✅ P3

**Goal**: Verify FR-010, FR-011 for built-in section management.

1. Open Our Cause config for a **fresh event** (first time — built-in cards should auto-seed).
2. Verify **About**, **Sponsors**, **Event Details** appear in the list with a **"Built-in"** badge.
3. Verify there is **no delete button** on built-in card rows.
4. Move **Sponsors** to the bottom by dragging.
5. Disable **About** using its toggle.
6. Click **Publish**.
7. Reload donor PWA — verify:
   - **Sponsors** appears at the bottom.
   - **About** section is hidden.

---

## Scenario 6: Concurrent Edit Conflict ✅ Edge Case

**Goal**: Verify optimistic concurrency (FR-018, FR-019).

1. Open Our Cause config in **two browser tabs** (same admin account).
2. In **Tab A**: reorder two cards → click **Save**.
3. In **Tab B** (which has the stale draft_version): try to reorder a different pair → click **Save**.
4. **Expected**: Tab B receives a **409 Conflict** error and shows a conflict resolution modal.
5. Choose one of the options:
   - **"Keep my changes"** → re-applies Tab B's changes on top of Tab A's version.
   - **"Discard my changes"** → reloads the page with Tab A's version.

---

## Scenario 7: Content Sanitisation ✅ Security

**Goal**: Verify server-side HTML sanitisation (FR-020, FR-021).

1. Create a Text card in the admin.
2. Using **browser DevTools** (Network tab), intercept or replay the `POST /api/v1/admin/events/{event_id}/cause-page/cards` request and inject `<script>alert(1)</script>` into the `content_html` field.
3. **Expected**: The response body does NOT contain `<script>`. The saved card shows the text content only.
4. Verify the donor PWA page does **not** execute any injected script.

---

## Scenario 8: Preview Before Publishing

**Goal**: Verify the inline preview (FR-014).

1. Create or edit any card with some content.
2. Click the **Preview** button on the Our Cause admin page.
3. **Expected**: A preview panel opens showing the donor-side card layout using current draft data (before publishing).

---

## API Smoke Tests (via `/docs`)

Navigate to `http://localhost:8000/docs` and try:

- `GET /api/v1/admin/events/{event_id}/cause-page/config` → returns `draft_version` and `published_version`
- `GET /api/v1/admin/events/{event_id}/cause-page/cards` → returns ordered draft cards
- `POST /api/v1/admin/events/{event_id}/cause-page/cards` with `{"card_type": "text", "draft_version": 1}` → creates card
- `GET /api/v1/events/{event_id}/cause-page/cards` (public, no auth) → returns only enabled published cards

---

## Edge Cases to Check

| Scenario | Expected Behaviour |
|----------|-------------------|
| Try to delete a built-in card via API | `422 Unprocessable Entity` |
| Set `background_color_token: "red-500"` (not in allowlist) | `422 Unprocessable Entity` |
| Slideshow slide with `slide_variant: "image_only"` but no `alt_text` | `422 Unprocessable Entity` |
| `video_url: "http://..."` (not HTTPS) | `422 Unprocessable Entity` |
| `video_url: "https://127.0.0.1/..."` (loopback) | `422 Unprocessable Entity` |
| Fresh event with no published cards | Donor PWA shows empty cause sections gracefully |
| Event with `published_version = 0` (never published) | `GET /events/{id}/cause-page/cards` returns `[]` |
