# Implementation Plan: 048 Attendee Profile Survey

**Branch**: `048-attendee-profile-survey` | **Date**: 2025-07-14 | **Spec**: `specs/048-attendee-profile-survey/spec.md`

## Summary

Add a configurable per-event attendee profile survey shown as a full-screen modal when a registered donor first accesses the event in the Donor PWA. The NPO configures questions/options/incentive-prompt/discount in the Admin PWA under a new "Survey" event sub-page. Completing the survey earns a discount applied as a negative line item at checkout. Survey answers auto-suggest donor category labels (Impact/Heart/Community/Participation Driven). Admins see survey responses and labels in the Donor Dashboard.

**Core technical approach:**
- 5 new DB tables: `event_survey_configs`, `survey_questions`, `survey_question_options`, `survey_responses`, `survey_answers`
- Small extensions to existing `donor_labels` (add `is_system_default`) and `donor_label_assignments` (add `is_suggested`, `source`)
- Add `SURVEY_DISCOUNT = "survey_discount"` to `CheckoutItemSourceTypeEnum`; inject as negative `CheckoutItem` on checkout build
- New admin API: `/admin/events/{event_id}/survey/*`
- New donor API: `/donor/events/{event_id}/survey/*`
- New admin PWA route: `/events/$eventId/survey`
- Survey modal in Donor PWA `events.$slug.index.tsx`
- Extended Donor Dashboard backend + frontend

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI 0.120, SQLAlchemy 2.0, Pydantic 2.0, Alembic (backend); React 18/19, Vite, TanStack Router, Zustand, Radix UI, Tailwind CSS 4 (frontend)
**Storage**: Azure Database for PostgreSQL (5 new tables + 2 modified + 1 enum extension)
**Testing**: pytest + pytest-asyncio (backend), pnpm build/lint (frontend)
**Target Platform**: Web (Admin PWA + Donor PWA) + FastAPI backend
**Performance Goals**: Survey status check <100ms; modal loads synchronously with page
**Constraints**: Survey modal must not block page render; discount must appear before donor confirms checkout
**Scale/Scope**: Per-event; typically 50–500 attendees per event

## Constitution Check

✅ **YAGNI**: Survey is event-scoped per spec; no multi-survey-per-event, no conditional branching
✅ **Donor-Driven**: Modal with skip option; no forced requirement; discount as positive incentive
✅ **Real-Time Reliability**: Survey submission is fire-once; retries safe (UNIQUE on registration_id)
✅ **No new infra**: All new tables fit in existing PostgreSQL; no new services or queues needed
✅ **Tenant isolation**: event_survey_config → event → npo_id; no cross-tenant data leakage

## Project Structure

### Documentation (this feature)

```
specs/048-attendee-profile-survey/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── contracts/
│   └── api-contracts.md # Phase 1 API contracts
└── tasks.md             # Phase 2 task list
```

### Source Code

```
backend/
├── app/
│   ├── models/
│   │   ├── event_survey_config.py       # NEW
│   │   ├── survey_question.py           # NEW
│   │   ├── survey_question_option.py    # NEW
│   │   ├── survey_response.py          # NEW
│   │   ├── survey_answer.py            # NEW
│   │   ├── donor_label.py              # MODIFY: add is_system_default
│   │   ├── donor_label_assignment.py   # MODIFY: add is_suggested, source
│   │   └── checkout_session.py         # MODIFY: add SURVEY_DISCOUNT enum value
│   ├── schemas/
│   │   ├── survey.py                   # NEW: all survey request/response schemas
│   │   └── donor_label.py             # MODIFY: add is_system_default, is_suggested, source
│   ├── services/
│   │   ├── survey_service.py           # NEW: CRUD + default seeding + label suggestion
│   │   ├── checkout_service.py         # MODIFY: inject survey discount item
│   │   └── donor_dashboard_service.py  # MODIFY: include survey data in donor profile
│   ├── api/v1/
│   │   ├── admin_event_survey.py       # NEW: admin survey config endpoints
│   │   ├── donor_survey.py             # NEW: donor survey status + submission
│   │   ├── admin_donor_labels.py       # MODIFY: add confirm-suggestions endpoint
│   │   ├── admin_donor_dashboard.py    # MODIFY: extend donor profile + leaderboard
│   │   └── __init__.py                # MODIFY: register new routers
│   └── models/__init__.py              # MODIFY: import new models
├── alembic/versions/
│   └── survey_001_add_survey_tables.py # NEW: migration

frontend/fundrbolt-admin/src/
├── routes/_authenticated/events/$eventId/
│   └── survey.tsx                      # NEW: route file
├── features/events/survey/
│   ├── EventSurveyPage.tsx             # NEW: main survey config page
│   ├── SurveyConfigForm.tsx            # NEW: prompt/discount settings
│   ├── SurveyQuestionList.tsx          # NEW: drag-reorder + add/edit/delete
│   └── SurveyQuestionEditor.tsx        # NEW: inline question + options editor
├── features/donor-dashboard/components/
│   ├── DonorProfilePanel.tsx           # MODIFY: add survey responses + label management
│   └── DonorLeaderboard.tsx            # MODIFY: add donor labels + survey_completed columns
├── services/
│   └── survey.ts                       # NEW: admin survey API client
└── lib/api/
    └── donor-labels.ts                 # MODIFY or NEW: confirm-suggestions call

frontend/donor-pwa/src/
├── lib/api/
│   └── survey.ts                       # NEW: donor survey API client
├── hooks/
│   └── use-survey-modal.ts             # NEW: hook to check + track modal state
├── components/survey/
│   └── SurveyModal.tsx                 # NEW: full-screen survey modal
└── routes/
    └── events.$slug.index.tsx          # MODIFY: integrate survey modal
```

## Complexity Tracking

No constitution violations.
