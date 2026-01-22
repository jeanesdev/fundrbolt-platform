# Implementation Plan: Centralized Brand Assets and Theme System

**Branch**: `016-branding` | **Date**: 2026-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-branding/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a centralized brand asset management system with theme configuration to ensure consistent branding across all frontend applications (admin PWA, donor PWA, landing site). Implement logo asset directory structure with multiple variants (Navy/Gold for light backgrounds, White/Gold for dark backgrounds) in SVG and PNG formats, define brand colors (Navy #11294c, Gold #ffc20e) in a shared theme configuration, configure favicons across all apps, establish system font stack for typography, host logos on Azure Blob Storage CDN for email templates, and enforce theme usage through ESLint with pre-commit hooks. All assets will be centralized in `frontend/shared/src/assets/` for single-source-of-truth management.

## Technical Context

**Language/Version**: TypeScript 5.x (Frontend), Python 3.11+ (Backend for email templates)
**Primary Dependencies**: React 18, Vite (build tool), ESLint (linting), Azure Blob Storage SDK (logo hosting)
**Storage**: Azure Blob Storage (logo assets for emails), File system (frontend shared package)
**Testing**: Vitest (unit tests), Playwright (E2E for visual verification)
**Target Platform**: Web (Chrome, Firefox, Safari, Edge), Mobile Web (iOS Safari, Android Chrome)
**Project Type**: Web application (frontend-focused with backend integration for emails)
**Performance Goals**: Asset load <100ms, no render-blocking fonts, CSS <50KB, logos optimized for web
**Constraints**: Navy background (#11294c) required globally, no hardcoded colors in components, system fonts only (no web font loading), email logo compatibility across clients
**Scale/Scope**: 3 frontend applications, 4 logo variants, 7 favicon sizes, 10+ color variables, system font stack definition

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Donor-Driven Engagement
✅ **PASS** - Branding consistency improves donor trust and reduces cognitive load. Favicon and logo visibility help donors quickly identify fundrbolt communications.

### Real-Time Reliability  
✅ **N/A** - No real-time requirements for branding assets (static assets).

### Production-Grade Quality
✅ **PASS** - Centralized asset management, linting enforcement, and documentation ensure maintainability. Theme system is testable and documented.

### Solo Developer Efficiency
✅ **PASS** - Uses existing Azure infrastructure (Blob Storage), system fonts (no custom font management), and standard ESLint/pre-commit tooling. Leverages Vite's built-in asset handling.

### Data Security and Privacy
✅ **N/A** - No user data involved (public branding assets).

### Minimalist Development (YAGNI)
✅ **PASS** - Builds only specified requirements: logo management, theme colors, favicons, typography, linting. No advanced theming features (dark mode, user customization) or animated logos.

### Technical Stack Alignment
✅ **PASS** - Uses existing frontend stack (React, Vite, TypeScript), existing Azure Blob Storage, ESLint already configured. No new infrastructure required.

### Code Quality Standards
✅ **PASS** - TypeScript strict mode, ESLint with pre-commit enforcement, comprehensive documentation (README files for each asset type).

### AI Development Constraints (YAGNI Enforcement)
✅ **PASS** - Feature tightly scoped: exact logo variants specified, exact color values provided, exact font stack defined. No extensibility beyond requirements.

**Result**: All gates PASSED. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```
specs/016-branding/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
frontend/shared/
├── src/assets/
│   ├── logos/
│   │   ├── fundrbolt-logo-navy-gold.svg
│   │   ├── fundrbolt-logo-white-gold.svg
│   │   ├── fundrbolt-logo-navy-gold.png
│   │   ├── fundrbolt-logo-white-gold.png
│   │   ├── SVG/           # Designer originals (multiple variants)
│   │   ├── PNG/           # Designer originals
│   │   ├── PDF/           # Designer originals
│   │   ├── JPEG/          # Designer originals
│   │   ├── Illustrator/   # Designer source files
│   │   └── README.md
│   ├── favicons/
│   │   ├── favicon.svg
│   │   ├── README.md
│   │   └── generate-favicons.js
│   ├── themes/
│   │   └── colors.ts
│   ├── index.ts
│   ├── vite-env.d.ts
│   ├── INTEGRATION_GUIDE.md
│   └── SETUP_COMPLETE.md
├── package.json
└── tsconfig.json

frontend/fundrbolt-admin/public/
├── favicon.ico
├── favicon.svg
├── favicon-16.png
├── favicon-32.png
├── favicon-192.png
├── favicon-512.png
└── apple-touch-icon.png

frontend/donor-pwa/public/
├── favicon.ico
├── favicon.svg
├── favicon-16.png
├── favicon-32.png
├── favicon-192.png
├── favicon-512.png
└── apple-touch-icon.png

frontend/landing-site/public/
├── favicon.ico
├── favicon.svg
├── favicon-16.png
├── favicon-32.png
├── favicon-192.png
├── favicon-512.png
└── apple-touch-icon.png

backend/app/services/
└── email_service.py        # Updated to reference Azure Blob CDN URLs

infrastructure/bicep/modules/
└── storage.bicep            # Azure Blob Storage with CDN configuration
```

**Structure Decision**: Web application structure with frontend-focused changes. Primary work in `frontend/shared/src/assets/` for centralized asset management. Backend changes minimal (email service update for logo URLs). Favicon files deployed to each app's `public/` directory for standard browser access.

## Complexity Tracking

*No Constitution Check violations - this section not needed.*

---

## Implementation Phases Status

### Phase 0: Research ✅ COMPLETE

**Status**: Research completed and documented in [research.md](./research.md)

**Decisions Made**:
- R1: System font stack configuration (modern cross-platform stack)
- R2: Azure Blob Storage CDN for email logo hosting
- R3: ESLint enforcement with pre-commit hooks (warnings + gate enforcement)
- R4: Vite asset handling best practices (using `?url` imports)
- R5: Favicon generation (online tools with manual placement)

**Artifacts**:
- [research.md](./research.md) - 5 research documents with decisions, rationale, alternatives

### Phase 1: Design & Contracts ✅ COMPLETE

**Status**: Data model, contracts, and quickstart guide completed

**Artifacts**:
- [data-model.md](./data-model.md) - 4 entities (Logo Asset, Theme Configuration, Favicon Set, Email Template Reference)
- [contracts/README.md](./contracts/README.md) - 4 contracts (Asset Export Interface, File Structure, Email Logo Integration, ESLint Configuration)
- [quickstart.md](./quickstart.md) - Developer onboarding guide with common use cases and troubleshooting
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) - Agent context updated with new technologies

**Constitution Re-check**: ✅ All gates still PASS

### Phase 2: Task Breakdown ✅ COMPLETE

**Status**: Tasks generated and organized by user story

**Artifacts**: [tasks.md](./tasks.md) - 79 tasks across 9 phases organized by user story

**Summary**:
- Phase 1 (Setup): 5 tasks - Verify existing asset structure
- Phase 2 (Foundational): 7 tasks - ESLint enforcement + Azure CDN infrastructure
- Phase 3 (US1): 8 tasks - Centralized logo management 🎯 MVP
- Phase 4 (US2): 12 tasks - Standardized color theme 🎯 MVP
- Phase 5 (US3): 11 tasks - Email logo integration
- Phase 6 (US4): 9 tasks - Favicon and browser branding
- Phase 7 (US5): 10 tasks - Typography system
- Phase 8 (US6): 8 tasks - Theme update workflow
- Phase 9 (Polish): 9 tasks - Cross-cutting concerns

**MVP Recommendation**: Phase 3 (US1) + Phase 4 (US2) = 20 implementation tasks (1-2 days)

**Parallel Opportunities**: 45 tasks marked [P] for parallel execution

---

## Notes

- **Asset Setup Already Complete**: During specification phase, the following work was completed:
  - Logo files from designer organized in `frontend/shared/src/assets/logos/`
  - Standardized logo filenames created (fundrbolt-logo-navy-gold, fundrbolt-logo-white-gold)
  - Theme colors defined in `themes/colors.ts`
  - TypeScript declarations for asset imports (`vite-env.d.ts`)
  - Favicon generation script created and executed for all 3 apps
  - Comprehensive documentation (INTEGRATION_GUIDE.md, README files)
  - Git commit with all branding assets

- **Remaining Implementation Work**:
  - Azure Blob Storage CDN setup for email logos (infrastructure)
  - ESLint rules configuration with pre-commit hooks (linting)
  - Email service updates to reference CDN URLs (backend)
  - Visual regression tests for logo display (testing)
  - Tailwind config updates to use brand colors (frontend)

- **No Database Changes**: This feature uses static assets only (no migrations required)

- **Feature Scope**: Tightly scoped to requirements - no dark mode toggle, no user customization, no animated logos
