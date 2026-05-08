# Implementation Plan: 045-printable-reports — Printable Reports & Export

**Branch**: `045-printable-reports` | **Date**: 2026-05-07 | **Spec**: `.specify/specs/045-printable-reports/spec.md`
**Input**: Feature specification from `/specs/045-printable-reports/spec.md`

## Summary

Three on-demand PDF reports generated server-side and streamed directly to the browser:
1. **NPO Event Summary Report** — full-color PDF with matplotlib charts mirroring the event dashboard (revenue by source, pacing, waterfall, cashflow timeline, all three segment leaderboards). Accessible from the event dashboard admin page.
2. **Bid Card Labels** — Brady label printer-compatible PDF with one card per page at the user-selected size (2″×3″, 2″×4″, 3″×3″, 3″×5″). Each card shows lot number, title, auction type, pricing, item image, and QR code. Accessible from the auction items list with multi-select.
3. **Auctioneer Financial Report** — PDF summarising event totals, per-item commissions, and category earnings. Accessible from the auctioneer dashboard.

**Technical approach**: Add two new Python dependencies (`matplotlib`, `qrcode[pil]`). Add `backend/app/services/event_report_service.py`, `bid_card_service.py`, and `auctioneer_report_service.py` (each using WeasyPrint + Jinja2 pattern established in `checkout_receipt_service.py`). Add `backend/app/api/v1/admin_reports.py` with 3 endpoints. Add Jinja2 HTML templates under `backend/app/templates/reports/`. No new DB tables. Frontend: new `reportService.ts`, reusable `DownloadReportButton` component with loading overlay, `BidCardSizeDialog`, and extend three existing pages (EventDashboardPage, AuctionItemsIndexPage, AuctioneerDashboardPage).

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, WeasyPrint ≥61 (already installed), Jinja2 ^3.1 (already installed), Pillow ^12 (already installed), **matplotlib ≥3.8** (new), **qrcode[pil] ≥7.4** (new), aiohttp ≥3.13 (already installed)
- Frontend: React 19, Vite 7, TanStack Router, TanStack Query 5, Zustand, Radix UI, Tailwind CSS 4, Lucide icons (all already installed)
**Storage**: No new tables. Reports are ephemeral — generated in-memory and streamed as `application/pdf`.
**Testing**: pytest (backend contract + integration tests), existing frontend CI (lint + build)
**Target Platform**: Web app — admin PWA (desktop/tablet)
**Project Type**: Web application (monorepo — backend + fundrbolt-admin frontend)
**Performance Goals**: Event report ≤15 s; bid cards (100 items) ≤30 s; auctioneer report ≤10 s (all per spec)
**Constraints**: Charts must include data labels for monochrome printability. No report persistence. Brady label PDF page dimensions must match physical label exactly. Image fetch failures must fall back gracefully to placeholder.
**Scale/Scope**: Per-event reports covering up to 500 registrations and 150 auction items

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Donor-Driven Engagement | ✅ PASS | Admin-facing feature; no donor UX impact |
| Real-Time Reliability | ✅ PASS | On-demand synchronous generation; no WebSocket required |
| Production-Grade Quality | ✅ PASS | Graceful image fallbacks, error overlays, access control per role |
| Solo Developer Efficiency | ✅ PASS | Reuses WeasyPrint, Jinja2, existing dashboard services; no new frameworks |
| Data Security and Privacy | ✅ PASS | Auctioneer commission data protected by `@require_role("auctioneer","super_admin")` |
| YAGNI | ✅ PASS | No report persistence, no report history, no scheduling; exactly what spec requires |

**Post-design re-check**: No violations introduced in Phase 1.

## Project Structure

### Documentation (this feature)

```
.specify/specs/045-printable-reports/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── reports-api.yaml
└── tasks.md             # Phase 2 output
```

### Source Code

```
backend/
├── app/
│   ├── schemas/
│   │   └── reports.py                         # NEW: LabelSize enum, BidCardRequest
│   ├── services/
│   │   ├── event_report_service.py            # NEW: matplotlib charts + WeasyPrint PDF
│   │   ├── bid_card_service.py                # NEW: QR codes + label-size PDF
│   │   └── auctioneer_report_service.py       # NEW: auctioneer financials PDF
│   ├── api/v1/
│   │   └── admin_reports.py                   # NEW: 3 PDF endpoints
│   └── templates/
│       └── reports/
│           ├── event_report.html              # NEW: Jinja2 + inline CSS for event PDF
│           ├── bid_cards.html                 # NEW: Jinja2 + inline CSS for label PDF
│           └── auctioneer_report.html         # NEW: Jinja2 + inline CSS for auctioneer PDF
├── pyproject.toml                             # EXTEND: add matplotlib, qrcode[pil]
└── app/main.py                                # EXTEND: register admin_reports router

frontend/fundrbolt-admin/src/
├── services/
│   └── reportService.ts                       # NEW: blob download client for 3 endpoints
├── components/
│   └── reports/
│       ├── DownloadReportButton.tsx           # NEW: button with in-page loading overlay
│       └── BidCardSizeDialog.tsx              # NEW: label size picker dialog
└── features/
    ├── event-dashboard/
    │   └── pages/
    │       └── EventDashboardPage.tsx         # EXTEND: add Download Report button
    ├── events/
    │   └── auction-items/
    │       └── AuctionItemsIndexPage.tsx      # EXTEND: multi-select + Print Bid Cards button
    └── auctioneer/
        └── pages/
            └── AuctioneerDashboardPage.tsx    # EXTEND: add Download Auctioneer Report button
```

**Structure Decision**: Web application (Option 2). Monorepo. All new backend code is additive. Three existing frontend pages are minimally extended with new buttons/dialogs — no page rewrites.

## Complexity Tracking

*No constitution violations requiring justification.*
