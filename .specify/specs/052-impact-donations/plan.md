# Implementation Plan: Impact Donations

**Branch**: `052-impact-donations` | **Date**: 2026-06-26 | **Spec**: [.specify/specs/052-impact-donations/spec.md](.specify/specs/052-impact-donations/spec.md)
**Input**: Feature specification from `/specs/052-impact-donations/spec.md`

## Summary

Add Impact Donations as a category-driven variant of the existing silent auction item model. Admins create and manage them from the Auction Items area, donors see them mixed into the Win It experience, and backend bid validation prevents standard bids while preserving buy-now purchases. The feature reuses the existing `auction_items.category` column and existing video media pipeline, so no new database tables or migrations are required.

## Technical Context

**Language/Version**: Python 3.11+ backend, TypeScript 5.x frontend
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, React, Vite, Zustand, React Query, Radix UI
**Storage**: PostgreSQL (existing auction_items.category column, auction item media table), Azure Blob Storage for media files
**Testing**: pytest, Ruff, mypy, pnpm lint, pnpm build
**Target Platform**: Web application (backend API + admin PWA + donor PWA)
**Project Type**: web
**Performance Goals**: Preserve existing auction item load and bid interactions; no new latency target beyond current app expectations
**Constraints**: No schema migration; keep buy-now purchase behavior intact; Impact Donations must not accept standard bids
**Scale/Scope**: Event-level fundraising UI and bid flow changes across existing admin and donor surfaces

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Donor-driven engagement: pass, feature centers donor buy-now support and clear classification.
- Real-time reliability: pass, no new real-time path or websocket dependency added.
- Production-grade quality: pass, implementation uses existing models and explicit validation.
- Solo developer efficiency: pass, minimal surface-area change with no new tables.
- Data security and privacy: pass, no new personal data handling.
- Minimalist development: pass, reuse existing category and media infrastructure.

## Project Structure

### Documentation (this feature)

```
specs/052-impact-donations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/v1/
│   ├── models/
│   ├── schemas/
│   └── services/
└── app/tests/

frontend/
├── fundrbolt-admin/src/
└── donor-pwa/src/
```

**Structure Decision**: This is a web application feature spanning `backend/` for validation and persistence plus `frontend/fundrbolt-admin` and `frontend/donor-pwa` for admin and donor experiences.

## Complexity Tracking

No constitution violations require justification.
