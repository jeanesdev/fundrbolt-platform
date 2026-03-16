# Implementation Plan: Payment Processing (First American / Deluxe)

**Branch**: `033-payment-processing` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `.specify/specs/033-payment-processing/spec.md`

## Summary

Integrate First American / Deluxe Merchant Services into FundrBolt so that NPOs can collect
payments from donors during events. Card data is never handled by FundrBolt — all card capture
uses Deluxe's Hosted Payment Form (HPF) iframe, keeping the platform at PCI SAQ-A scope. Each
NPO has its own merchant account; funds settle directly to the NPO's bank.

Core flows: (1) NPO super-admin configures per-NPO Deluxe credentials; (2) donors save a card
through the HPF; (3) donors purchase tickets; (4) donors complete end-of-night self-checkout
(outstanding auction wins + donations in one charge, with optional tip and optional processing-fee
coverage); (5) admins can charge / void / refund on behalf of donors; (6) every successful charge
auto-generates a PDF receipt and emails it to the donor.

A `PaymentGatewayPort` ABC with a `StubPaymentGateway` is implemented first so the entire
backend flow works without real Deluxe credentials. `DeluxePaymentGateway` is a drop-in swap once
credentials are available.

## Technical Context

**Language/Version**: Python 3.11 (backend) + TypeScript 5.x / React 19 (donor PWA & admin PWA)
**Primary Dependencies**:
  - Backend: FastAPI 0.120+, SQLAlchemy 2.0, Pydantic 2.0, Alembic, httpx, WeasyPrint, Jinja2, celery[redis]
  - Frontend (donor-pwa): React 19, Vite 7, TanStack Router, Zustand, Radix UI, Tailwind CSS 4
  - Frontend (fundrbolt-admin): React 19, Vite 7, TanStack Router, Zustand, React Query, Radix UI
**Storage**: Azure Database for PostgreSQL (primary data); Azure Blob Storage (receipt PDFs); Azure Cache for Redis (session/rate-limit/Celery broker+backend)
**Background Jobs**: Celery worker (processes `generate_and_send_receipt` tasks) + Celery beat scheduler (runs `expire_pending_transactions` every 5 min, `retry_failed_receipts` every 10 min) — both must run alongside the FastAPI app process in every environment
**Testing**: pytest + pytest-asyncio + httpx (backend); vitest + Playwright (frontend)
**Target Platform**: Linux server (Azure App Service) + web PWA (mobile-first)
**Project Type**: web (backend + two frontend PWAs)
**Performance Goals**: End-of-night checkout — donor completes payment in < 3 min; receipt email delivered within 5 min of successful charge; API p95 < 300 ms
**Constraints**: PCI SAQ-A compliance (zero raw card data in FundrBolt systems); idempotent payment requests (no duplicate charges on retry/double-submit); webhook primary + polling fallback for transaction resolution; credentials encrypted at rest (never returned in full from any API)
**Scale/Scope**: MVP target — 100 concurrent bidders per event, 10 simultaneous events; payment operations are relatively infrequent (< 10 req/s at peak)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | No plaintext passwords or card numbers stored (Immutable Constraint 3) | ✅ PASS | HPF offloads all card capture to Deluxe; only vault token + masked display fields stored |
| 2 | No hard-coded secrets (Immutable Constraint 4) | ✅ PASS | Deluxe credentials stored in DB encrypted; injected from Azure Key Vault at runtime |
| 3 | No skipping database migrations (Immutable Constraint 5) | ✅ PASS | All schema changes via Alembic; 4 new tables, 2 column additions |
| 4 | API backward compatibility (Immutable Constraint 6) | ✅ PASS | All new endpoints under `/api/v1/payments/` — no existing endpoints modified at schema level |
| 5 | Log security-relevant events (Immutable Constraint 8) | ✅ PASS | FR-033 mandates audit log for every charge/void/refund with actor, timestamp, amount, outcome |
| 6 | YAGNI — build only what is specified (Immutable Constraint 11) | ✅ PASS | Stub gateway deferred to real Deluxe only; no multi-currency, no ACH, no subscription billing |
| 7 | All code must pass CI: ruff, mypy strict, pytest (Constitution §Code Quality) | ✅ PASS | Must be enforced per `.github/copilot-instructions.md`; no merging with red CI |
| 8 | Type hints + Pydantic on all boundaries (Constitution §Type Safety) | ✅ PASS | All new service methods carry full type hints; all API request/response bodies are Pydantic models |
| 9 | HTTPS / TLS everywhere (Immutable Constraint 9) | ✅ PASS | HPF iframe served from Deluxe over HTTPS; all backend calls to Deluxe via httpx with TLS |
| 10 | Audit log for all sensitive actions (Immutable Constraint 8) | ✅ PASS | `payment_transactions` table is effectively the immutable audit record; `initiated_by` FK captures admin actor |

**Constitution Check Result**: ✅ ALL GATES PASS — proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```
.specify/specs/033-payment-processing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── donor-payments.md
│   ├── admin-payments.md
│   └── npo-credentials.md
└── tasks.md             # Phase 2 output (NOT created here)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   ├── payment_gateway_credential.py   # NEW — per-NPO encrypted Deluxe credentials
│   │   ├── payment_profile.py              # NEW — donor vault token (saved card reference)
│   │   ├── payment_transaction.py          # NEW — every charge / void / refund record
│   │   └── payment_receipt.py              # NEW — receipt metadata (PDF URL, email status)
│   ├── schemas/
│   │   └── payment.py                      # NEW — all Pydantic request/response models
│   ├── services/
│   │   ├── payment_gateway/
│   │   │   ├── __init__.py
│   │   │   ├── port.py                     # NEW — PaymentGatewayPort ABC
│   │   │   ├── stub_gateway.py             # NEW — StubPaymentGateway (dev/staging)
│   │   │   └── deluxe_gateway.py           # NEW — DeluxePaymentGateway (Phase 6 activation)
│   │   ├── payment_profile_service.py      # NEW — vault CRUD, default management
│   │   ├── payment_transaction_service.py  # NEW — session creation, webhook, charge, void, refund
│   │   ├── checkout_service.py             # NEW — end-of-night balance aggregation + charge
│   │   └── receipt_service.py              # NEW — WeasyPrint PDF + email dispatch
│   └── api/
│       └── v1/
│           ├── payments.py                 # NEW — donor-facing payment endpoints
│           ├── admin_payments.py           # NEW — admin charge/void/refund/transaction list
│           └── admin_npo_credentials.py    # NEW — super-admin credential CRUD
├── alembic/versions/
│   └── [hash]_add_payment_tables.py        # NEW — migration for all 4 payment tables + FK additions
└── templates/
    └── receipts/
        └── receipt.html                    # NEW — Jinja2 + WeasyPrint receipt template

frontend/
├── donor-pwa/
│   └── src/
│       ├── routes/
│       │   ├── events.$slug.tickets.tsx    # NEW — public ticket browse (unauthenticated)
│       │   ├── events.$slug.checkout.tsx   # NEW — end-of-night checkout flow
│       │   └── settings.payment-methods.tsx # NEW — saved card management
│       ├── components/
│       │   ├── payments/
│       │   │   ├── HpfIframe.tsx           # NEW — Hosted Payment Form iframe wrapper
│       │   │   ├── SavedCardList.tsx        # NEW — masked card display + delete + set-default
│       │   │   ├── CheckoutSummary.tsx     # NEW — itemized balance + tip + fee coverage
│       │   │   └── ReceiptView.tsx         # NEW — in-app receipt (fallback when email fails)
│       └── api/
│           └── payments.ts                 # NEW — typed API client for all payment endpoints
└── fundrbolt-admin/
    └── src/
        ├── routes/
        │   ├── events.$eventId.donors.$donorId.tsx  # MODIFIED — add balance + charge button
        │   └── npos.$npoId.payment-settings.tsx     # NEW — super-admin credential management
        └── components/
            └── payments/
                ├── DonorBalancePanel.tsx    # NEW — outstanding balance view + admin charge
                ├── TransactionHistory.tsx   # NEW — transaction list with void/refund actions
                └── NpoCredentialForm.tsx    # NEW — masked credential entry + test connection
```

**Structure Decision**: Web application (Option 2). This feature spans all three sub-projects
(backend + donor-pwa + fundrbolt-admin). All backend code lives in `backend/app/` under the
existing FastAPI monolith; frontend code lives in the respective PWA packages under `frontend/`.
