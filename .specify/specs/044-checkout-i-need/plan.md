# Implementation Plan: 044-checkout-i-need — Donor Event Checkout

**Branch**: `044-checkout-i-need` | **Date**: 2026-05-05 | **Spec**: `.specify/specs/044-checkout-i-need/spec.md`
**Input**: Feature specification from `/specs/044-checkout-i-need/spec.md`

## Summary

End-of-night donor checkout page for the Donor PWA allowing donors to review committed charges (auction wins, quick-entry bids, tickets, etc.), add optional tips, select a payment method (Card/Cash/Check/DAF), confirm via double-swipe, and receive an email with a PDF receipt. Admin controls allow NPO Admins to open checkout (manually or scheduled), monitor per-donor checkout status, adjust line items with audit logging, and send checkout link/reminder notifications to donors.

**Technical approach**: Enhance the existing `events.$slug.checkout.tsx` route (485 lines) and `CheckoutService` (314 lines). Add 4 new PostgreSQL tables (`checkout_sessions`, `checkout_items`, `checkout_configurations`, `processing_fee_configs`), a `CheckoutConfigurationService`, a Celery task for scheduled auto-open, WeasyPrint for PDF receipts, and new Admin PWA pages for checkout control and donor status dashboard. Reuse `BidConfirmSlide` slider pattern and `@ncdai/react-wheel-picker` from Donate Now.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic, Celery+Redis (scheduled auto-open), WeasyPrint (PDF receipts), Pillow (image processing for receipt logo)
- Frontend: React 19, Vite 7, TanStack Router, TanStack Query 5, Zustand, Radix UI, Tailwind CSS 4, `@ncdai/react-wheel-picker` (already installed), existing `BidConfirmSlide` slider pattern (reuse/extend)
**Storage**: Azure Database for PostgreSQL — 4 new tables: `checkout_sessions`, `checkout_items`, `checkout_configurations`, `processing_fee_configs`; no changes to existing `events` table (all new config in `checkout_configurations`)
**Testing**: pytest (backend), existing frontend CI (lint + build)
**Target Platform**: Web app + PWA (mobile-first, optimised for phones/tablets)
**Project Type**: Web application (monorepo — backend + two frontends)
**Performance Goals**: Checkout page load <1 s; admin status dashboard <2 s for 200+ donors; real-time update polling every 10 s (SC-005)
**Constraints**: Payment processing STUBBED (no real gateway calls). Existing checkout route MUST be enhanced, not replaced. Receipt PDF MUST embed event logo. Processing fee snapshotted at checkout-open time.
**Scale/Scope**: Per-event checkout with 50–500 donors per event

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Donor-Driven Engagement | ✅ PASS | Double-swipe, tips, contact-admin all reduce friction and preserve state |
| Real-Time Reliability | ✅ PASS | 10 s polling for item updates (SC-005); no WebSocket required |
| Production-Grade Quality | ✅ PASS | Audit log, idempotency keys, snapshotted fee rate, PDF receipt |
| Solo Developer Efficiency | ✅ PASS | Reuse existing BidConfirmSlide, WheelPicker, notification infrastructure |
| Data Security and Privacy | ✅ PASS | Audit log for all admin changes (FR-026a); checkout session tied to user_id |
| YAGNI | ✅ PASS | Only building what spec requires; payment stubbed; no real gateway |

**Post-design re-check**: No violations introduced in Phase 1.

## Project Structure

### Documentation (this feature)

```
.specify/specs/044-checkout-i-need/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── checkout-donor.yaml
│   ├── checkout-admin.yaml
│   ├── checkout-processing-fee.yaml
│   └── checkout-session.yaml
└── tasks.md             # Phase 2 output
```

### Source Code

```
backend/
├── app/
│   ├── models/
│   │   ├── checkout_session.py        # NEW: CheckoutSession, CheckoutItem, CheckoutStatus enum
│   │   ├── checkout_configuration.py  # NEW: CheckoutConfiguration
│   │   └── processing_fee_config.py   # NEW: ProcessingFeeConfig
│   ├── schemas/
│   │   └── checkout.py                # NEW: all checkout Pydantic schemas
│   ├── services/
│   │   ├── checkout_service.py        # EXTEND: add session persistence, tips, cash/check
│   │   └── checkout_configuration_service.py  # NEW
│   ├── api/v1/
│   │   ├── payments.py                # EXTEND: donor checkout endpoints
│   │   └── admin_payments.py          # EXTEND: admin checkout control + dashboard
│   └── tasks/
│       └── checkout_tasks.py          # NEW: Celery scheduled-open task
├── alembic/versions/
│   └── xxxx_checkout_tables.py        # NEW migration

frontend/donor-pwa/src/
├── routes/
│   └── events.$slug.checkout.tsx      # EXTEND: tips, 4 payment methods, swipe×2, receipt
├── components/
│   ├── checkout/
│   │   ├── CheckoutTipSection.tsx     # NEW
│   │   ├── SwipeToConfirm.tsx         # NEW (reuses BidConfirmSlide pattern)
│   │   ├── CheckoutPaymentMethods.tsx # NEW (4 options incl. cash/check/DAF)
│   │   ├── CheckoutReceiptView.tsx    # NEW (read-only post-completion)
│   │   ├── CheckoutUpdateBanner.tsx   # NEW (admin modified items banner)
│   │   └── ContactAdminForm.tsx       # NEW
│   ├── payments/
│   │   └── CheckoutSummaryCard.tsx    # NEW (My Event page card)
│   └── event-home/
│       └── MyEventCheckoutSection.tsx # EXTEND or NEW card injection
├── lib/api/
│   └── checkout.ts                    # NEW: API client functions
└── stores/
    └── checkout-store.ts              # NEW: Zustand store for state persistence

frontend/fundrbolt-admin/src/
├── features/
│   └── events/
│       ├── checkout/
│       │   ├── CheckoutControlPanel.tsx     # NEW: open/schedule/close
│       │   ├── DonorCheckoutDashboard.tsx   # NEW: per-donor status list
│       │   ├── DonorCheckoutItemEditor.tsx  # NEW: add/remove/reprice items
│       │   └── CheckoutReceiptActions.tsx   # NEW: view/download/resend receipt
│       └── EventEditPage.tsx               # EXTEND: add checkout tab/section
├── lib/api/
│   └── checkout.ts                    # NEW: admin API client
└── components/settings/
    └── ProcessingFeeConfig.tsx        # NEW: Super Admin global rate setting
```

**Structure Decision**: Web application (Option 2). Monorepo with backend FastAPI service and two React PWA frontends (donor-pwa, fundrbolt-admin). All new code is additive — existing files extended, not replaced.

## Complexity Tracking

*No constitution violations requiring justification.*
