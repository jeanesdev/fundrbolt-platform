# Manual Testing Guide: Donate Now Page (Feature 041)

## Prerequisites

- Local dev environment running: `make dev-fullstack`
- Docker services up: `make docker-up` (PostgreSQL, Redis)
- Database migrated: `make migrate`
- At least one NPO seeded with an `npo_slug` value

## Setup: Seed an NPO Slug

The new `npos.slug` column must be populated. Run:

```bash
cd backend
poetry run python -c "
from app.core.database import SyncSessionLocal
from app.models.npo import NPO
import re

with SyncSessionLocal() as db:
    npos = db.query(NPO).all()
    for npo in npos:
        if not npo.slug:
            npo.slug = re.sub(r'[^a-z0-9]+', '-', npo.name.lower()).strip('-')
    db.commit()
    for npo in npos:
        print(f'{npo.name} -> {npo.slug}')
"
```

---

## 1. Admin PWA — Donate Now Configuration

**URL**: `http://localhost:5173/npos/{npoId}/donate-now`

### 1.1 Enable the Donate Now Page

1. Navigate to **NPOs** → select an NPO → click **Donate Now** (heart icon in the action bar).
2. Confirm the page loads with tabs: **General**, **Donation Tiers**, **NPO Info**, **Support Wall**.
3. Toggle the **Enable Donate Now page** switch ON.
4. Verify the toggle saves and stays ON after page refresh.

### 1.2 General Config

1. On the **General** tab, fill in:
   - **Plea text**: "Help us make a difference this year"
   - **Hero media URL**: a direct image URL (e.g., a PNG on the web)
   - **Processing fee %**: `2.90`
2. Click **Save Configuration**.
3. Verify a success toast appears.

### 1.3 Hero Image Upload

1. Click **Upload Hero Image**.
2. Select any image file (JPG, PNG, WebP).
3. Verify the upload completes and the **Hero media URL** field auto-populates with an Azure Blob URL.
4. Save and verify the URL persists.

### 1.4 Donation Tiers

1. Navigate to the **Donation Tiers** tab.
2. Click **Add Tier** three times.
3. Set amounts: `25`, `50`, `100`.
4. Set impact statements for each (optional).
5. Click **Save Tiers**.
6. Refresh and confirm tiers reappear.
7. **Edge case**: Try adding more than 10 tiers — verify the **Add Tier** button becomes disabled at 10.

### 1.5 NPO Info Tab

1. Navigate to **NPO Info** tab.
2. Enter multi-paragraph text describing the NPO.
3. Save and verify it persists.

### 1.6 Support Wall Moderation

1. Navigate to the **Support Wall** tab.
2. (Requires a donation first — come back after Section 3.)
3. Verify each entry shows: donor name/Anonymous, amount (if shown), message.
4. Click **Hide** on an entry — verify it disappears from the public wall.
5. Click **Restore** — verify it reappears.

---

## 2. Public Donate Now Page (Donor PWA)

**URL**: `http://localhost:5174/npo/{npoSlug}/donate-now`

Replace `{npoSlug}` with the slug from the seed step (e.g., `http://localhost:5174/npo/my-npo/donate-now`).

### 2.1 Page Load

1. Open the page in a browser (logged out or logged in — it works both ways).
2. Verify:
   - Hero image/video displays at the top.
   - NPO name and plea text appear in the hero overlay.
   - Donation tiers appear as buttons below the hero.
   - "Support Wall" and "About" sections are visible.

### 2.2 Donation Amount Selection

1. Click each tier button — verify it highlights and the summary updates.
2. Click **Custom Amount** or type in the custom input field.
3. Enter `75` — verify the total updates.

### 2.3 Processing Fee Toggle

1. Check the **Cover processing fee** checkbox.
2. Verify the summary shows the fee amount and an updated total.
3. Uncheck — verify the total returns to the base amount.

### 2.4 Monthly Donation Toggle

1. Toggle **Make this a monthly donation** ON.
2. Verify the donate button text changes to reflect monthly.
3. Toggle OFF.

### 2.5 Support Wall Message

1. Type a message in the **Optional message** textarea.
2. Check **Donate anonymously**.
3. Check **Show donation amount on wall**.

### 2.6 One-Time Donation Flow

> **Note**: This requires a working payment gateway configured for the NPO. If not configured, the API will return an error — that's expected.

1. Select a tier (e.g., $25).
2. Click **Donate $25.00**.
3. The **Confirm Your Donation** dialog should appear.
4. Verify it shows: amount, NPO name, monthly status.
5. Click **Confirm** — if payment gateway is configured, a success overlay should appear.
6. The success overlay should show the amount, monthly status, "Thank you!" message, and a **Done** button.
7. After closing, verify the entry appears on the Support Wall (may take a moment).

### 2.7 Disabled Page

1. Go to the Admin PWA and toggle the **Enable Donate Now page** switch OFF.
2. Reload the public page.
3. Verify it shows an error/unavailable message (the API returns 404 for disabled pages).

### 2.8 Non-existent NPO Slug

1. Navigate to `http://localhost:5174/npo/does-not-exist/donate-now`.
2. Verify the page displays a user-friendly "not available" message — not a blank screen or JS error.

---

## 3. Support Wall (Public)

1. After making a donation (Section 2.6), scroll to the **Support Wall** section.
2. Verify the entry appears with the correct display name (or "Anonymous"), amount (if opted in), and message.
3. Reload the page and verify the wall persists.

---

## 4. API Endpoints (Backend)

Test with curl or the FastAPI docs at `http://localhost:8000/docs` (search "Donate Now").

### 4.1 Get Public Donate Now Page

```bash
curl http://localhost:8000/api/v1/npos/{npo_slug}/donate-now
```

Expected: JSON with `npo_name`, `tiers`, `is_enabled: true`, etc.

### 4.2 Get Support Wall

```bash
curl http://localhost:8000/api/v1/npos/{npo_slug}/donate-now/support-wall
```

Expected: `{ "entries": [...], "total": N, "page": 1, "per_page": 20, "pages": N }`

### 4.3 Admin Config Endpoints

```bash
# Requires auth token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/admin/npos/{npo_id}/donate-now/config
```

---

## 5. Monthly Recurring (Celery Beat)

The recurring donation job runs daily via Celery Beat. To test manually:

```bash
cd backend
poetry run celery -A app.celery_app call app.tasks.recurring_donation_tasks.process_monthly_donations
```

Or trigger it via the Celery worker + beat:

```bash
# Terminal 1: Start worker
poetry run celery -A app.celery_app worker -l info

# Terminal 2: Start beat
poetry run celery -A app.celery_app beat -l info
```

Verify in the worker logs that `process_monthly_donations` fires and processes any due recurring donations.

---

## 6. Edge Cases to Verify

| Scenario | Expected Result |
|---|---|
| Donate $0 or negative amount | Donate button disabled / validation error |
| Donate with no payment profile (logged out) | API error "payment method required" or prompts login |
| NPO without slug | Admin Donate Now link should still work (uses npo_id) |
| Hero video URL (`.mp4`) | Video element renders instead of `<img>` |
| Support wall with 0 entries | Shows "Be the first to donate!" message |
| Tier with no impact statement | Tier still renders without the statement line |

---

## 7. Related Admin Navigation

- **NPO Detail Page** (`/npos/{npoId}`): Verify the **Donate Now** button (heart icon) is visible and navigates correctly.
