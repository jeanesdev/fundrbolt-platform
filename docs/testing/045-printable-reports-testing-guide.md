# Feature 045 — Printable Reports: Manual Testing Guide

This guide covers manual verification of all three PDF report types added in feature 045. Work through each section end-to-end before calling the feature complete.

---

## Prerequisites

- Admin PWA running at `http://localhost:5173`
- Backend running at `http://localhost:8000`
- At least one published event with:
  - A few published auction items (at least 2–3 SILENT or LIVE type)
  - At least one registration/guest
  - A sponsor with a logo URL
- An NPO Admin user account (for event report + bid cards)
- An Auctioneer user account (for the auctioneer report)

---

## 1. Event Summary Report

### Access
1. Log in as **NPO Admin** or **Super Admin**
2. Navigate to an event → **Event Dashboard** tab
3. Look for a **"Download Report"** button in the top-right toolbar (next to the Refresh button)

### Positive Checks
- [ ] Button is visible in the toolbar
- [ ] Clicking "Download Report" shows a **full-page loading overlay** ("Generating PDF, please wait…") with a spinner
- [ ] After a few seconds, a PDF file is downloaded (filename: `event-report-<eventId>.pdf`)
- [ ] Open the PDF and verify:
  - [ ] **Header** shows the NPO logo (or placeholder) + event name + date
  - [ ] **KPI row** shows 5 metric cards (Total Raised, Registrations, Auction Items, Avg Donation, etc.)
  - [ ] **Revenue chart** (bar chart) is present and labelled
  - [ ] **Cashflow timeline** (line chart) is present
  - [ ] **Waterfall** chart is present
  - [ ] **Segment tables** (Live Auction, Silent Auction, Paddle Raise) appear below charts
  - [ ] **Footer** has page number and generated timestamp

### Role Access Checks
- [ ] Log in as **NPO Staff** → navigate to Event Dashboard → "Download Report" button should NOT be visible (or 403 if calling API directly)
- [ ] Log in as **Donor** user → button should NOT be visible

### Edge Cases
- [ ] If the event has no registrations/donations, verify the report still generates (empty tables/zeroed KPIs) without crashing

---

## 2. Bid Cards

### Access
1. Log in as **NPO Admin**, **NPO Staff**, or **Super Admin**
2. Navigate to an event → **Auction Items** page
3. Look for a **"Print Bid Cards"** button in the page header (next to "Add Item")

### Positive Checks — All Items
- [ ] "Print Bid Cards" button is visible when `typeFilter` is NOT "Revenue Generators"
- [ ] Clicking opens a **dialog** with 4 size options:
  - 2" × 3" (Small badge)
  - 2" × 4" (Standard address label) — should be **highlighted/selected** by default (3×5 is default actually)
  - 3" × 3" (Square label)
  - 3" × 5" (Index card) — this is the default
- [ ] Clicking a size option highlights it
- [ ] Clicking **"Generate & Download"** shows a loading spinner in the button
- [ ] After generation, PDF downloads (filename: `bid-cards-3-by-5-<eventId>.pdf`)
- [ ] Dialog closes after successful download
- [ ] Open PDF and verify:
  - [ ] One card per page
  - [ ] Lot number, title, type badge (e.g., "SILENT"), and description visible
  - [ ] Item image displayed (or placeholder)
  - [ ] Starting bid and buy-now price shown
  - [ ] "Donated by:" attribution shown (if populated)
  - [ ] QR code in bottom corner links to correct donor PWA URL (`/events/<slug>/auction/<id>`)
  - [ ] Page size matches selected label (3×5 card should be ~216×360pt)

### Different Label Sizes
- [ ] Test generating with **2×4** size — verify pages are letter-label dimensions
- [ ] Test generating with **2×3** size — verify correct small dimensions

### Cancellation
- [ ] Click "Print Bid Cards" → click **Cancel** → dialog closes, no download

### Role Access Checks
- [ ] Log in as **Check-in Staff** → "Print Bid Cards" button should NOT be visible

### Edge Cases
- [ ] If all items are in **DRAFT** status: generate should return an error toast ("No published auction items found")
- [ ] If the event has Revenue Generator items but no auction items: switch to "All" filter and test

---

## 3. Auctioneer Financial Report

### Access
1. Log in as **Auctioneer** or **Super Admin**
2. Navigate to an event → **Auctioneer Dashboard**
3. Look for a **"Financial Report"** button in the page header (top-right area)

### Positive Checks
- [ ] Button is visible at the top of the Auctioneer Dashboard
- [ ] Clicking shows the **loading overlay** ("Generating PDF, please wait…")
- [ ] PDF downloads (filename: `auctioneer-report-<eventId>.pdf`)
- [ ] Open the PDF and verify:
  - [ ] **Header** with auctioneer name and event name
  - [ ] **Event Revenue Summary** table: Silent, Live, Paddle Raise, and Revenue Generator totals
  - [ ] **Category-Based Earnings** table: categories with bid count, total sold, commission rate, and earnings
  - [ ] **Per-Item Commission Detail** table: individual items with lot number, buyer, amount, and commission
  - [ ] **Grand Total** box at the bottom with total commission earned
  - [ ] Purple theme (`#7c3aed`) accent colour

### Role Access Checks
- [ ] Log in as **NPO Admin** (not auctioneer role) → Financial Report button should NOT be visible (403)
- [ ] Log in as **NPO Staff** → button should NOT be visible

### Super Admin Viewing Another Auctioneer's Report
- [ ] As **Super Admin**, add `?auctioneer_user_id=<UUID>` query parameter to the API call to verify it uses the specified auctioneer's commission data (advanced testing, requires API access)

---

## 4. Error Handling

### Network/Generation Errors
- [ ] With backend stopped, click any report button → verify a **toast error** appears ("Failed to generate report. Please try again.")
- [ ] Loading overlay disappears after the error

### Unauthorized Access
- [ ] Directly call `GET /api/v1/admin/events/{id}/reports/event-summary` without auth token → expect `401 Unauthorized`
- [ ] Call with a **Donor** role token → expect `403 Forbidden`

---

## 5. API Direct Verification (Optional — Advanced)

You can test endpoints directly via the Swagger UI at `http://localhost:8000/docs`:

```
GET  /api/v1/admin/events/{event_id}/reports/event-summary
POST /api/v1/admin/events/{event_id}/reports/bid-cards
     Body: { "label_size": "3x5" }
     Body: { "label_size": "2x4", "item_ids": ["uuid1", "uuid2"] }
GET  /api/v1/admin/events/{event_id}/auctioneer/report
```

Verify each returns `Content-Type: application/pdf` and a `Content-Disposition: attachment` header.

---

## 6. Completion Checklist

Check all boxes before closing the feature:

- [ ] Event Summary Report downloads and renders correctly
- [ ] Bid Cards generate for all 4 sizes
- [ ] Auctioneer Report downloads and renders correctly
- [ ] Role access enforced (wrong roles get 403)
- [ ] Error toasts appear on failure
- [ ] Loading overlays appear during generation
- [ ] No console errors in browser dev tools during any report download
- [ ] Downloaded PDFs open cleanly in a PDF reader (no corrupt file warnings)
