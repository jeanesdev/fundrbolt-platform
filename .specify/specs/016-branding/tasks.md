# Tasks: Centralized Brand Assets and Theme System

**Feature Branch**: `016-branding`
**Input**: Design documents from `.specify/specs/016-branding/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Not explicitly requested in feature specification - focusing on implementation tasks

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## 📊 Overall Progress: 41/79 tasks (52%)
- ✅ **MVP Complete**: 32/32 tasks (100%) - US1 & US2 fully functional
- 🚧 **US3 Email Logos**: 9/11 tasks (82%) - 1 manual test remaining
- ⏳ **US4 Favicons**: 0/9 tasks
- ⏳ **US5-US6**: Not started

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Web app with monorepo: `frontend/shared/`, `frontend/fundrbolt-admin/`, `frontend/donor-pwa/`, `frontend/landing-site/`, `backend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare for branding integration

**Note**: Most asset setup was completed during specification phase. This phase focuses on validation and tool configuration.

- [X] T001 Verify frontend/shared/src/assets/ directory structure exists with logos/, favicons/, themes/ subdirectories
- [X] T002 Verify all logo files are present in frontend/shared/src/assets/logos/ (4 files: navy-gold and white-gold in SVG and PNG)
- [X] T003 Verify themes/colors.ts exists with all brand colors defined (Navy #11294c, Gold #ffc20e, White #ffffff, Gray #58595b)
- [X] T004 [P] Install husky and lint-staged in root package.json for pre-commit hooks
- [X] T005 [P] Verify vite-env.d.ts exists in frontend/shared/src/assets/ with type declarations for SVG/PNG imports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configure linting enforcement and Azure infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Configure ESLint rule for hardcoded color detection in .eslintrc.js (warn on hex/rgb/hsl literals)
- [X] T007 Add ESLint exemption for frontend/shared/src/assets/themes/colors.ts file
- [X] T008 Configure lint-staged in root package.json to run ESLint with --max-warnings 0 on TypeScript files
- [X] T009 Create .husky/pre-commit hook that runs lint-staged
- [X] T010 [P] Create Azure Bicep module for Blob Storage container 'branding' with public blob access in infrastructure/bicep/modules/storage.bicep
- [X] T011 [P] Create Azure Bicep module for CDN profile and endpoint 'fundrbolt-branding' in infrastructure/bicep/modules/cdn.bicep
- [X] T012 Test pre-commit hook by attempting commit with hardcoded color (should fail)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Centralized Logo Asset Management (Priority: P1) 🎯 MVP

**Goal**: Enable developers to import logo files from shared package into any frontend app with consistent branding

**Independent Test**: Import LogoNavyGold and LogoWhiteGold into one frontend app and verify both logos render correctly

### Implementation for User Story 1

- [X] T013 [P] [US1] Create TypeScript interface LogoAsset in frontend/shared/src/assets/types.ts with name, background, svgPath, pngPath, altText fields
- [X] T014 [P] [US1] Export logo constants (LogoNavyGold, LogoWhiteGold) from frontend/shared/src/assets/index.ts using existing imports
- [X] T015 [P] [US1] Create getLogo() helper function in frontend/shared/src/assets/index.ts that returns logo based on background type ('light' | 'dark')
- [X] T016 [US1] Update frontend/shared/package.json to ensure "./assets" export is configured
- [X] T017 [US1] Create comprehensive README.md in frontend/shared/src/assets/logos/ with usage examples and variant selection guide
- [X] T018 [US1] Test logo imports in frontend/fundrbolt-admin by creating test component that renders both logo variants
- [X] T019 [US1] Test logo imports in frontend/donor-pwa by creating test component that renders logo based on theme
- [X] T020 [US1] Test logo imports in frontend/landing-site by adding logo to header component

**Checkpoint**: At this point, User Story 1 should be fully functional - logos importable and rendering in all 3 apps

---

## Phase 4: User Story 2 - Standardized Color Theme System (Priority: P1) 🎯 MVP

**Goal**: Ensure all applications reference centralized theme colors instead of hardcoded values

**Independent Test**: Import colors from shared package, apply to UI components, verify Navy background and consistent colors across one app

### Implementation for User Story 2

- [X] T021 [P] [US2] Export colors object from frontend/shared/src/assets/index.ts (already defined in themes/colors.ts)
- [X] T022 [P] [US2] Export BrandColors TypeScript type from frontend/shared/src/assets/index.ts for type safety
- [X] T023 [P] [US2] Create Tailwind CSS config extension in frontend/fundrbolt-admin/tailwind.config.js with brand color utilities (brand-navy, brand-gold, brand-gray)
- [X] T024 [P] [US2] Create Tailwind CSS config extension in frontend/donor-pwa/tailwind.config.js with brand color utilities
- [X] T025 [P] [US2] Create Tailwind CSS config extension in frontend/landing-site/tailwind.config.js with brand color utilities
- [X] T026 [US2] Update root layout in frontend/fundrbolt-admin/src/routes/__root.tsx to apply Navy background globally
- [X] T027 [US2] Update root layout in frontend/donor-pwa/src/routes/__root.tsx to apply Navy background globally
- [X] T028 [US2] Update root layout in frontend/landing-site/src/routes/__root.tsx to apply Navy background globally
- [X] T029 [P] [US2] Audit frontend/fundrbolt-admin for hardcoded color values and replace with theme imports (automated with grep or ESLint fix)
- [X] T030 [P] [US2] Audit frontend/donor-pwa for hardcoded color values and replace with theme imports
- [X] T031 [P] [US2] Audit frontend/landing-site for hardcoded color values and replace with theme imports
- [X] T032 [US2] Create theme usage examples in frontend/shared/src/assets/INTEGRATION_GUIDE.md showing inline styles, Tailwind utilities, and TypeScript usage

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - logos importable and all apps using theme colors consistently

---

## Phase 5: User Story 3 - Logo Integration in Email Templates (Priority: P2)

**Goal**: Email templates include fundrbolt logo hosted on Azure CDN for brand recognition and trust

**Independent Test**: Deploy logo PNGs to Azure Blob Storage, update email service, send test email, verify logo displays

**Dependencies**: Requires Azure Blob Storage and CDN from Phase 2 (T010, T011)

### Implementation for User Story 3

- [X] T033 [US3] Upload fundrbolt-logo-navy-gold.png to Azure Blob Storage container 'branding/logos/' via Azure Portal or CLI
- [X] T034 [US3] Upload fundrbolt-logo-white-gold.png to Azure Blob Storage container 'branding/logos/' via Azure Portal or CLI
- [X] T035 [US3] Verify public blob access by testing CDN URLs in browser (https://fundrboltdevstor.blob.core.windows.net/branding/logos/fundrbolt-logo-white-gold.png)
- [X] T036 [US3] Add AZURE_CDN_LOGO_BASE_URL to backend/app/core/config.py Settings class with default value
- [X] T037 [US3] Create _get_logo_url() method in backend/app/services/email_service.py that returns CDN URL based on background parameter
- [X] T038 [US3] Update _render_email_template() method in backend/app/services/email_service.py to inject logo_url and logo_alt into context
- [X] T039 [US3] Update email base template in backend/app/templates/emails/base.html to use {{ logo_url }} with Navy background header
- [X] T040 [US3] Update verification email template to reference base.html logo
- [X] T041 [US3] Update password reset email template to reference base.html logo
- [ ] T042 [US3] Send test verification email and verify logo displays in Gmail, Outlook, Apple Mail
- [X] T043 [US3] Add AZURE_CDN_LOGO_BASE_URL to .env.example with documentation

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work - emails now include branded logo from CDN

---

## Phase 6: User Story 4 - Favicon and Browser Branding (Priority: P2)

**Goal**: Browser tabs, bookmarks, and mobile home screens display fundrbolt favicon for easy identification

**Independent Test**: Open each app in browser, verify favicon appears in tab; add to mobile home screen, verify icon

**Note**: Favicon files already generated and deployed during specification phase. This phase focuses on HTML integration.

### Implementation for User Story 4

- [ ] T044 [P] [US4] Update frontend/fundrbolt-admin/index.html <head> to include all 7 favicon link tags (ICO, SVG, 16/32/180/192/512 PNGs)
- [ ] T045 [P] [US4] Update frontend/donor-pwa/index.html <head> to include all 7 favicon link tags
- [ ] T046 [P] [US4] Update frontend/landing-site/index.html <head> to include all 7 favicon link tags
- [ ] T047 [P] [US4] Test favicon display in Chrome on desktop (check browser tab icon)
- [ ] T048 [P] [US4] Test favicon display in Firefox on desktop (check browser tab icon)
- [ ] T049 [P] [US4] Test favicon display in Safari on macOS (check browser tab icon)
- [ ] T050 [P] [US4] Test Apple Touch Icon on iOS by adding landing-site to home screen
- [ ] T051 [P] [US4] Test Android home screen icon by adding donor-pwa to home screen
- [ ] T052 [US4] Document favicon regeneration process in frontend/shared/src/assets/favicons/README.md

**Checkpoint**: All browsers and mobile devices now display fundrbolt favicon correctly

---

## Phase 7: User Story 5 - Typography and Font System (Priority: P3)

**Goal**: Standardized font families and typographic scales ensure consistent text display across all applications

**Independent Test**: Apply font system to components in one app, verify system fonts load correctly with proper fallbacks

### Implementation for User Story 5

- [ ] T053 [P] [US5] Export fontFamily constant from frontend/shared/src/assets/index.ts (already defined in themes/colors.ts)
- [ ] T054 [P] [US5] Create typography scale object in frontend/shared/src/assets/themes/typography.ts with font sizes, line heights, font weights for h1-h6, body, small, caption
- [ ] T055 [P] [US5] Export typography scale from frontend/shared/src/assets/index.ts
- [ ] T056 [P] [US5] Update Tailwind config in frontend/fundrbolt-admin/tailwind.config.js to extend fontFamily with system font stack
- [ ] T057 [P] [US5] Update Tailwind config in frontend/donor-pwa/tailwind.config.js to extend fontFamily with system font stack
- [ ] T058 [P] [US5] Update Tailwind config in frontend/landing-site/tailwind.config.js to extend fontFamily with system font stack
- [ ] T059 [P] [US5] Apply fontFamily to body element in frontend/fundrbolt-admin/src/routes/__root.tsx global styles
- [ ] T060 [P] [US5] Apply fontFamily to body element in frontend/donor-pwa/src/routes/__root.tsx global styles
- [ ] T061 [P] [US5] Apply fontFamily to body element in frontend/landing-site/src/routes/__root.tsx global styles
- [ ] T062 [US5] Create typography examples in frontend/shared/src/assets/INTEGRATION_GUIDE.md showing h1-h6, body text, and caption styles

**Checkpoint**: System fonts now load consistently across all apps with proper fallback chain

---

## Phase 8: User Story 6 - Theme Update Workflow (Priority: P3)

**Goal**: Enable brand managers to update theme values in one location and propagate changes to all applications

**Independent Test**: Change a theme value (e.g., adjust gold shade), rebuild apps, verify change reflects everywhere

### Implementation for User Story 6

- [ ] T063 [US6] Document theme update workflow in frontend/shared/src/assets/INTEGRATION_GUIDE.md including steps to update colors.ts
- [ ] T064 [US6] Document rebuild process for all apps after theme changes in frontend/shared/src/assets/INTEGRATION_GUIDE.md
- [ ] T065 [US6] Add TypeScript const assertions to colors.ts to enable type checking of color values
- [ ] T066 [US6] Create validation script in frontend/shared/src/assets/scripts/validate-theme.ts that checks for valid hex colors and required fields
- [ ] T067 [US6] Add npm script "validate:theme" to frontend/shared/package.json that runs validation script
- [ ] T068 [US6] Test theme update workflow by changing Gold color from #ffc20e to #ffc30f temporarily and rebuilding all apps
- [ ] T069 [US6] Revert test theme change and document validation results in INTEGRATION_GUIDE.md
- [ ] T070 [US6] Add change log section to frontend/shared/src/assets/themes/CHANGELOG.md for tracking theme updates

**Checkpoint**: Theme update workflow documented and validated - brand managers can now confidently update theme values

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements, documentation, and validation across all user stories

- [ ] T071 [P] Run pre-commit hook validation across all frontend apps to ensure no hardcoded colors remain
- [ ] T072 [P] Update project README.md in repository root to mention centralized branding system location
- [ ] T073 [P] Create SETUP_COMPLETE.md in frontend/shared/src/assets/ summarizing implementation status and next steps
- [ ] T074 [P] Update .github/copilot-instructions.md with branding asset usage guidelines (if not already done)
- [ ] T075 Verify all 10 success criteria from spec.md are met (SC-001 through SC-010)
- [ ] T076 Create visual regression test baseline screenshots for logo display in all 3 apps (if Playwright configured)
- [ ] T077 [P] Add logo and theme usage examples to quickstart.md
- [ ] T078 Final code review: Verify all tasks complete, documentation accurate, no hardcoded colors, logos rendering correctly
- [ ] T079 Create pull request with comprehensive description linking to spec.md, plan.md, and tasks.md

---

## Dependencies & Execution Strategy

### User Story Dependency Graph

```
Phase 1 (Setup) → Phase 2 (Foundational)
                       ↓
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
    Phase 3 (US1) → Phase 4 (US2)  Phase 3 (US1)
         ↓                           ↓
    Phase 5 (US3)              Phase 6 (US4)
    [requires US1]             [requires US1]
         ↓                           ↓
    Phase 7 (US5)              Phase 8 (US6)
    [requires US2]             [requires US2]
         ↓                           ↓
         └────────────┬─────────────┘
                      ↓
                 Phase 9 (Polish)
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 9

**Parallel Opportunities**:
- **After Phase 2**: US1 (Phase 3) can start immediately
- **After US1**: US3 (Phase 5) and US4 (Phase 6) can run in parallel
- **After US2**: US5 (Phase 7) and US6 (Phase 8) can run in parallel
- **Within phases**: Tasks marked [P] can run in parallel

### MVP Scope (User Story 1 + User Story 2)

**Recommended MVP**: Deliver just Phase 3 (US1) and Phase 4 (US2) first

**Why**:
- US1: Provides centralized logo management - immediate value for developers
- US2: Ensures consistent brand colors across apps - critical for brand identity
- These two stories deliver 80% of the value with 40% of the effort
- Remaining stories (email logos, favicons, typography, update workflow) can be delivered incrementally

**MVP Delivery**:
1. Complete Phase 1 (Setup) - 5 tasks
2. Complete Phase 2 (Foundational) - 7 tasks
3. Complete Phase 3 (US1) - 8 tasks
4. Complete Phase 4 (US2) - 12 tasks
5. **Total MVP**: 32 tasks, estimated 1-2 days of work

**Post-MVP Increments**:
- **Increment 2**: Phase 5 (US3 - Email logos) - 11 tasks, 0.5-1 day
- **Increment 3**: Phase 6 (US4 - Favicons) - 9 tasks, 0.5 day
- **Increment 4**: Phase 7 (US5 - Typography) - 10 tasks, 0.5-1 day
- **Increment 5**: Phase 8 (US6 - Update workflow) - 8 tasks, 0.5 day
- **Increment 6**: Phase 9 (Polish) - 9 tasks, 0.5 day

### Parallel Execution Examples

**Phase 3 (US1) Parallelization**:
```bash
# All [P] tasks can run simultaneously:
- T013 [P] [US1] Create types.ts
- T014 [P] [US1] Export logos from index.ts
- T015 [P] [US1] Create getLogo() helper
- T017 [P] [US1] Create README.md

# Then sequentially:
- T016 [US1] Update package.json exports
- T018, T019, T020 [US1] Test in all 3 apps
```

**Phase 4 (US2) Parallelization**:
```bash
# Export tasks in parallel:
- T021 [P] [US2] Export colors
- T022 [P] [US2] Export BrandColors type

# Tailwind configs in parallel:
- T023 [P] [US2] Tailwind config - admin
- T024 [P] [US2] Tailwind config - donor
- T025 [P] [US2] Tailwind config - landing

# Root layouts sequentially (one per app):
- T026 [US2] Root layout - admin
- T027 [US2] Root layout - donor
- T028 [US2] Root layout - landing

# Audits in parallel:
- T029 [P] [US2] Audit admin
- T030 [P] [US2] Audit donor
- T031 [P] [US2] Audit landing

# Documentation sequentially:
- T032 [US2] Create integration guide
```

**Phase 6 (US4) Full Parallelization**:
```bash
# All favicon HTML updates can run simultaneously:
- T044 [P] [US4] Update admin index.html
- T045 [P] [US4] Update donor index.html
- T046 [P] [US4] Update landing index.html

# All browser tests can run simultaneously:
- T047 [P] [US4] Test Chrome
- T048 [P] [US4] Test Firefox
- T049 [P] [US4] Test Safari
- T050 [P] [US4] Test iOS
- T051 [P] [US4] Test Android

# Documentation sequentially:
- T052 [US4] Document regeneration
```

---

## Task Summary

**Total Tasks**: 79 tasks across 9 phases

**Breakdown by Phase**:
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 7 tasks
- Phase 3 (US1 - Logo Management): 8 tasks 🎯 MVP
- Phase 4 (US2 - Color Theme): 12 tasks 🎯 MVP
- Phase 5 (US3 - Email Logos): 11 tasks
- Phase 6 (US4 - Favicons): 9 tasks
- Phase 7 (US5 - Typography): 10 tasks
- Phase 8 (US6 - Update Workflow): 8 tasks
- Phase 9 (Polish): 9 tasks

**Parallelization**:
- 45 tasks marked [P] for parallel execution
- Maximum parallelization: 12 tasks can run simultaneously in Phase 4

**Story Distribution**:
- US1 (P1): 8 tasks
- US2 (P1): 12 tasks
- US3 (P2): 11 tasks
- US4 (P2): 9 tasks
- US5 (P3): 10 tasks
- US6 (P3): 8 tasks
- Setup/Foundational: 12 tasks
- Polish: 9 tasks

**Independent Test Criteria Met**:
- ✅ Each user story has clear checkpoint describing what should work independently
- ✅ User Story 1: "Logos importable and rendering in all 3 apps"
- ✅ User Story 2: "All apps using theme colors consistently"
- ✅ User Story 3: "Emails include branded logo from CDN"
- ✅ User Story 4: "Browsers and mobile display favicon correctly"
- ✅ User Story 5: "System fonts load consistently across all apps"
- ✅ User Story 6: "Theme update workflow documented and validated"

**Format Validation**: ✅ All tasks follow checklist format with checkbox, ID, [P]/[Story] labels, and file paths

**MVP Recommendation**: Phase 3 (US1) + Phase 4 (US2) = 20 implementation tasks delivering centralized logos and theme colors

---

## Notes

- Most asset setup (logos, colors, favicons) was completed during specification phase, significantly reducing implementation effort
- Azure Blob Storage and CDN setup (T010, T011) are one-time infrastructure tasks that can be automated with Bicep
- ESLint pre-commit enforcement (Phase 2) ensures long-term theme compliance without manual reviews
- Typography system (US5) builds on existing theme system - minimal new infrastructure needed
- Visual regression tests (T076) are optional but recommended if Playwright is already configured
- Theme validation script (T066) prevents invalid color values from being committed
