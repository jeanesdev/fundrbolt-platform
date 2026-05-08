# Quickstart: 045-printable-reports — Printable Reports & Export

**Branch**: `045-printable-reports` | **Date**: 2026-05-07

---

## Prerequisites

```bash
# Backend: install new dependencies
cd backend && poetry install

# Verify new libs loaded
poetry run python -c "import matplotlib; import qrcode; print('OK')"
```

---

## Backend: Download Event Summary Report

```bash
# Get an auth token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Download event PDF report (replace EVENT_ID with a real event UUID)
EVENT_ID="<uuid>"
curl -X GET "http://localhost:8000/api/v1/admin/events/${EVENT_ID}/reports/event-summary" \
  -H "Authorization: Bearer $TOKEN" \
  --output event_report.pdf

open event_report.pdf
```

---

## Backend: Download Bid Cards

```bash
# Download bid cards for specific items
ITEM1="<uuid1>"
ITEM2="<uuid2>"
curl -X POST "http://localhost:8000/api/v1/admin/events/${EVENT_ID}/reports/bid-cards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"item_ids\": [\"${ITEM1}\", \"${ITEM2}\"], \"label_size\": \"3x5\"}" \
  --output bid_cards.pdf

# Download bid cards for ALL published items
curl -X POST "http://localhost:8000/api/v1/admin/events/${EVENT_ID}/reports/bid-cards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label_size": "2x4"}' \
  --output bid_cards_all.pdf

open bid_cards.pdf
```

---

## Backend: Download Auctioneer Report

```bash
# Log in as auctioneer
AUCTIONEER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"auctioneer@example.com","password":"password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X GET "http://localhost:8000/api/v1/admin/events/${EVENT_ID}/auctioneer/report" \
  -H "Authorization: Bearer $AUCTIONEER_TOKEN" \
  --output auctioneer_report.pdf

open auctioneer_report.pdf
```

---

## Frontend: Trigger Report Downloads

1. **Event Summary Report**: Navigate to any event → "Dashboard" tab → click "Download Report" button in the top-right of the dashboard header.

2. **Bid Cards**: Navigate to any event → "Auction Items" tab → check items → click "Print Bid Cards" → choose label size in dialog → PDF downloads.

3. **Auctioneer Report**: Log in as Auctioneer → navigate to any event → "Auctioneer" tab → click "Download Report" button at the top of the auctioneer dashboard.

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/event_report_service.py` | Event PDF generation with matplotlib charts |
| `backend/app/services/bid_card_service.py` | Bid card PDF generation with QR codes |
| `backend/app/services/auctioneer_report_service.py` | Auctioneer PDF generation |
| `backend/app/api/v1/admin_reports.py` | 3 PDF download endpoints |
| `backend/app/schemas/reports.py` | `LabelSize` enum + `BidCardRequest` |
| `backend/app/templates/reports/event_report.html` | Jinja2 HTML template for event PDF |
| `backend/app/templates/reports/bid_cards.html` | Jinja2 HTML template for bid card labels |
| `backend/app/templates/reports/auctioneer_report.html` | Jinja2 HTML template for auctioneer PDF |
| `frontend/.../services/reportService.ts` | Blob download API client |
| `frontend/.../components/reports/DownloadReportButton.tsx` | Reusable button with loading overlay |
| `frontend/.../components/reports/BidCardSizeDialog.tsx` | Label size selection dialog |
| `frontend/.../features/event-dashboard/pages/EventDashboardPage.tsx` | Extended with download button |
| `frontend/.../features/events/auction-items/AuctionItemsIndexPage.tsx` | Extended with bid card UI |
| `frontend/.../features/auctioneer/pages/AuctioneerDashboardPage.tsx` | Extended with report button |
