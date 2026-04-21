# Implementation Plan: Donate Now Page

**Branch**: `041-donate-now-page` | **Date**: 2026-04-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/041-donate-now-page/spec.md`

## Summary

A public NPO-specific donation page (`/npo/$npoSlug/donate-now`) enabling one-time and monthly recurring donations with configurable branding, a slide-to-donate flow, a support wall, and an NPO admin configuration panel. The backend extends the existing Deluxe HPF payment integration with new donation entities; the frontend creates a new public donor-PWA route reusing the event hero, slide-to-confirm, and auth-gate patterns.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x / React 19 (donor PWA frontend), TypeScript 5.x / React 19 (admin PWA frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (backend); React 19, Vite 7, TanStack Router, Zustand, Radix UI, Tailwind CSS 4 (donor PWA + admin PWA); Celery + Redis (recurring charge scheduling)
**Storage**: Azure Database for PostgreSQL (donations, support wall, config, NPO slug); Azure Blob Storage (hero media, reusing existing NPO branding blob container); Azure Cache for Redis (Celery broker for recurring payment tasks)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web PWA (donor-pwa at port 5174), Admin PWA (fundrbolt-admin at port 5173), FastAPI backend (port 8000)
**Performance Goals**: Page load ≤2s; donation submission ≤3s end-to-end; support wall renders ≤500ms
**Constraints**: PCI scope inherited from existing Deluxe HPF integration (vault re-charge only, no raw card data); GDPR — donor data deletable; no new auth mechanism; NPO slug immutable once set
**Scale/Scope**: ~50 NPOs initially; support wall paginated (5/page); recurring charge job runs daily

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|---|---|---|
| YAGNI — no speculative features | ✅ Pass | Building exactly what spec defines |
| Donor experience prioritized | ✅ Pass | Slide-to-donate, inline success, frictionless auth |
| Real-time reliability scope | ✅ Pass | Support wall is not real-time (poll on load); no WebSocket needed |
| PCI compliance | ✅ Pass | Reuses existing HPF vault token path; no raw card data stored |
| GDPR | ✅ Pass | Donations soft-deletable; anonymous donor option |
| Type safety | ✅ Pass | All new code in Python 3.11+ with mypy strict; TypeScript strict |
| Test coverage | ✅ Pass | Unit + integration tests for all new endpoints |
| No new projects/repos | ✅ Pass | Changes to existing backend + donor-pwa + admin-pwa only |

## Project Structure

### Documentation (this feature)

```
specs/041-donate-now-page/
├── plan.md              ← this file
├── research.md          ← Phase 0 complete
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── donate-now.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```
backend/
├── alembic/versions/
│   ├── 043a_add_npo_slug.py              ← new: slug field on npos table
│   └── 043b_add_donate_now_tables.py     ← new: 4 new tables
├── app/
│   ├── models/
│   │   ├── npo.py                        ← modify: add slug field
│   │   ├── donate_now_config.py          ← new
│   │   ├── donation_tier.py              ← new
│   │   ├── donation.py                   ← new
│   │   └── support_wall_entry.py         ← new
│   ├── schemas/
│   │   ├── donate_now_config.py          ← new
│   │   ├── donation.py                   ← new
│   │   └── support_wall_entry.py         ← new
│   ├── services/
│   │   ├── donate_now_service.py         ← new
│   │   └── recurring_donation_service.py ← new
│   ├── tasks/
│   │   └── recurring_donation_tasks.py   ← new: Celery beat task
│   └── api/v1/
│       ├── public_donate_now.py          ← new: public donor endpoints
│       └── admin_donate_now.py           ← new: admin config + moderation endpoints

frontend/donor-pwa/src/
├── routes/
│   └── npo.$slug.donate-now.tsx          ← new: public donate-now route
├── components/donate-now/
│   ├── DonateNowHeroSection.tsx          ← new: thin wrapper over EventHeroSection
│   ├── DonationTierButtons.tsx           ← new: preset amount buttons
│   ├── DonationAmountSelector.tsx        ← new: spinner/selector adapted for donations
│   ├── DonationSlider.tsx                ← new: wrapper over BidConfirmSlide
│   ├── DonationConfirmDialog.tsx         ← new: second confirmation with fee checkbox
│   ├── MonthlyRecurrenceFields.tsx       ← new: start/end date pickers (conditional)
│   ├── SupportWallMessageForm.tsx        ← new: message + anonymity checkboxes
│   ├── SupportWall.tsx                   ← new: paginated wall with auto-cycle
│   ├── SupportWallEntry.tsx              ← new: single entry card
│   └── DonationSuccessOverlay.tsx        ← new: inline success animation
├── features/donate-now/
│   ├── DonateNowPage.tsx                 ← new: authenticated donor view
│   └── useDonatNow.ts                    ← new: donation state hook
└── api/
    └── donateNow.ts                      ← new: API client calls

frontend/fundrbolt-admin/src/
├── routes/
│   └── npos/$npoId/donate-now/
│       ├── index.tsx                     ← new: donate-now config landing
│       ├── hero.tsx                      ← new: hero config tab
│       ├── tiers.tsx                     ← new: donation tiers tab
│       ├── info.tsx                      ← new: NPO info section tab
│       └── wall.tsx                      ← new: support wall moderation tab
└── components/donate-now/
    ├── DonateNowConfigForm.tsx           ← new
    ├── DonationTierEditor.tsx            ← new
    └── SupportWallModerationTable.tsx    ← new
```

**Structure Decision**: Web application (Option 2). Changes span backend (FastAPI/SQLAlchemy), donor PWA (React), and admin PWA (React). All within the existing monorepo.

## Complexity Tracking

*No constitution violations.*
