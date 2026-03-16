# Implementation Plan: Auction Items

**Branch**: `008-auction-items` | **Date**: 2025-11-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-auction-items/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add comprehensive auction item management to the FundrBolt platform, enabling event coordinators to create and manage auction items for both live and silent auctions. Items support rich media uploads (images/videos), detailed descriptions, sponsor attribution, buy-now functionality, and automatic 3-digit bid number assignment starting at 100. Media files stored in Azure Blob Storage with pre-signed URLs for secure access. Follows existing patterns from events and sponsors features.

## Technical Context

**Language/Version**: Python 3.11+
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, Azure Blob Storage SDK, Pillow (image processing)
**Storage**: Azure Database for PostgreSQL (auction item data, metadata), Azure Blob Storage (images/videos)
**Testing**: pytest with pytest-asyncio, factory-boy fixtures, 80%+ coverage target
**Target Platform**: Linux server (Azure App Service), PWA frontend (React/TypeScript)
**Project Type**: Web application (backend API + frontend client)
**Performance Goals**:

- Image upload/processing: <10 seconds per file
- Item list pagination: <2 seconds for 500 items
- Media gallery: <1 second first 3 images (lazy load remaining)
**Constraints**:
- API latency p95 <300ms
- Max 10MB per image, 100MB per video
- Max 20 images + 5 videos per item
- Bid numbers 100-999 per event (auto-increment)
**Scale/Scope**:
- 100-500 auction items per event
- 10 simultaneous events (MVP)
- 1000+ registered users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Gates (from Constitution)

✅ **Security First**: All media uploads will use Azure Blob Storage with pre-signed SAS URLs, private container access, and signed read URLs with 15-minute expiry. Input validation on all fields, SQL injection prevention via SQLAlchemy ORM.

✅ **Testing Coverage**: Target 80%+ test coverage with unit tests (bid number logic, validation rules, buy-now constraints), integration tests (CRUD operations, media upload flow), and E2E tests (create item → upload media → publish → view as bidder).

✅ **YAGNI Compliance**: Implementing only specified requirements. Deferred to Phase 2: bulk CSV import, AI-powered descriptions, multi-sponsor support, reserve pricing, item categories/tags, duplicate detection across events.

✅ **Type Safety**: Python type hints on all functions, Pydantic models for API schemas and validation, mypy strict mode in CI pipeline.

✅ **API Versioning**: All endpoints under `/api/v1/events/{event_id}/auction-items/` namespace. Backward compatible changes only.

✅ **Audit Logging**: All create/update/delete operations logged with user ID, timestamp, and change details in structured JSON format.

✅ **Performance SLOs**: API latency p95 <300ms target. Pagination for item lists (50 per page default, 100 max). Lazy loading for media gallery. Database indexes on event_id, status, auction_type.

✅ **Existing Patterns**: Follows established patterns from events (media uploads), sponsors (logo handling, Azure Blob integration), and authentication (RBAC, permissions).

### Constitution Alignment

- **Donor-Driven Engagement**: Item catalog optimized for browsing/discovery, rich media galleries, clear pricing display
- **Real-Time Reliability**: Item data cached in Redis for fast access during active bidding
- **Production-Grade Quality**: Comprehensive error handling, retry logic for blob uploads, soft deletes with audit trail
- **Solo Developer Efficiency**: Reusing existing MediaService patterns, no custom upload handlers needed
- **Data Security**: Encrypted blob storage, signed URLs, no sensitive data in logs
- **Minimalist Development (YAGNI)**: Building exactly what's specified, no extra features

**Result**: ✅ All gates passed. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/008-auction-items/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── auction-items-openapi.yaml
│   └── schemas.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── alembic/
│   └── versions/
│       └── XXXX_add_auction_items.py          # Database migration
├── app/
│   ├── models/
│   │   └── auction_item.py                    # AuctionItem, AuctionItemMedia models
│   ├── schemas/
│   │   ├── auction_item.py                    # Pydantic schemas
│   │   └── auction_item_media.py              # Media-specific schemas
│   ├── services/
│   │   ├── auction_item_service.py            # Business logic
│   │   └── auction_item_media_service.py      # Media upload handling
│   ├── api/
│   │   └── v1/
│   │       ├── auction_items.py               # CRUD endpoints
│   │       └── auction_item_media.py          # Media upload endpoints
│   └── tests/
│       ├── unit/
│       │   ├── test_auction_item_service.py
│       │   └── test_bid_number_assignment.py
│       ├── integration/
│       │   ├── test_auction_item_crud.py
│       │   └── test_auction_item_media.py
│       └── e2e/
│           └── test_auction_item_workflow.py
└── static/
    └── uploads/                                # Local dev only (Azure Blob in prod)

frontend/fundrbolt-admin/
├── src/
│   ├── components/
│   │   └── auction-items/
│   │       ├── AuctionItemList.tsx
│   │       ├── AuctionItemForm.tsx
│   │       ├── MediaUploadZone.tsx
│   │       └── MediaGallery.tsx
│   ├── pages/
│   │   └── events/
│   │       └── [eventId]/
│   │           └── auction-items/
│   │               ├── index.tsx              # List view
│   │               ├── create.tsx             # Create form
│   │               └── [itemId]/
│   │                   └── edit.tsx           # Edit form
│   └── services/
│       └── auctionItemService.ts              # API client
└── tests/
    └── e2e/
        └── auction-items.spec.ts               # Playwright tests

frontend/donor-pwa/                             # Phase 2: Bidder view
├── src/
│   ├── components/
│   │   └── auction/
│   │       ├── ItemCatalog.tsx
│   │       └── ItemDetail.tsx
│   └── pages/
│       └── events/
│           └── [eventId]/
│               └── auction/
│                   ├── index.tsx              # Catalog
│                   └── [itemId]/
│                       └── index.tsx          # Detail
```

**Structure Decision**: Web application (backend + frontend) following existing monorepo layout. Backend uses FastAPI service layer pattern (models → schemas → services → API routes). Frontend uses React with TypeScript following feature-based organization. Auction items are scoped under events (parent-child relationship) consistent with sponsors and event media patterns.

## Complexity Tracking

No constitution violations identified. All patterns follow existing architecture from events, sponsors, and media upload features.
