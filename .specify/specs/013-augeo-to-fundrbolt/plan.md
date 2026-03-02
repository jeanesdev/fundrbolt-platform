# Implementation Plan: Fundrbolt to Fundrbolt Rename

**Branch**: `013-fundrbolt-to-fundrbolt` | **Date**: 2025-12-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-fundrbolt-to-fundrbolt/spec.md`

**Note**: This plan covers the systematic rename of all brand, code, infrastructure, and documentation assets from Fundrbolt to Fundrbolt.

## Summary

Complete rebranding from Fundrbolt to Fundrbolt across source code, databases, GitHub repositories, Azure resources, and all customer-facing surfaces. No backward compatibility is required (pre-production state). Immediate cutover with no maintenance window needed. All naming changes are additive to existing codebases or direct replacements where Fundrbolt naming is embedded in identifiers, configs, and infrastructure labels.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend), Bash/YAML (infrastructure)
**Primary Dependencies**: FastAPI, React, Vite, SQLAlchemy, Pydantic, Azure CLI, Bicep, GitHub Actions
**Storage**: Azure Database for PostgreSQL, Azure Blob Storage
**Testing**: pytest (backend), Vitest/Playwright (frontend), Terraform/Bicep validation (infra)
**Target Platform**: Linux servers, web browsers, cloud infrastructure (Azure)
**Project Type**: Multi-tier web application (backend API + multiple frontend PWAs) + infrastructure
**Performance Goals**: No changes to performance; rename is structural, not functional
**Constraints**: All renaming must preserve functionality and data integrity; database migrations required
**Scale/Scope**: Multi-repo rename (backend, frontend/fundrbolt-admin, frontend/donor-pwa, frontend/landing-site, infrastructure, docs); ~20+ GitHub repositories/resources; 5+ Azure services; 1000s of code references

## Constitution Check

**GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.**

| Principle | Check | Status |
|-----------|-------|--------|
| Donor-Driven Engagement | Rename maintains existing UX; no feature changes | ✅ PASS |
| Real-Time Reliability | No WebSocket/networking changes; latency goals unaffected | ✅ PASS |
| Production-Grade Quality | Rename requires comprehensive testing and rollback plan | ✅ PASS |
| Solo Developer Efficiency | Automated tooling (search-replace, scripts) to reduce manual work | ✅ PASS |
| Data Security & Privacy | Database migrations must preserve encryption and audit trails | ✅ PASS |
| Minimalist Development (YAGNI) | Rename is narrowly scoped; only changes names, no new features | ✅ PASS |

All principles aligned. No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/013-fundrbolt-to-fundrbolt/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (research findings)
├── data-model.md        # Phase 1 output (affected entities & migrations)
├── quickstart.md        # Phase 1 output (rename execution steps)
├── contracts/           # Phase 1 output (API naming changes, if any)
└── checklists/
    └── requirements.md  # Quality assurance checklist
```

### Source Code & Infrastructure Affected

**Monorepo Structure** (all located at `/home/jjeanes/fundrbolt-platform`):

```
backend/
├── app/
│   ├── main.py          # App title, description, contact info
│   ├── core/            # Config with Fundrbolt refs
│   ├── middleware/      # Fundrbolt branding in responses
│   ├── models/          # Database model docstrings
│   ├── schemas/         # Pydantic schema descriptions
│   └── services/        # Service names, logging
├── alembic/
│   └── versions/        # New migration for any db config changes
└── pyproject.toml       # Poetry project name, description

frontend/
├── fundrbolt-admin/         # Rename directory to fundrbolt-admin
│   ├── src/
│   │   ├── components/  # Component names, strings, comments
│   │   ├── pages/       # Page titles, meta tags
│   │   └── assets/      # Logos, branding
│   └── package.json
├── donor-pwa/           # Keep name (product-facing, not admin-specific)
│   ├── src/
│   │   ├── components/  # Brand text in UI
│   │   ├── assets/      # Logo, favicon
│   │   └── manifest.json # App name, description
│   └── package.json
└── landing-site/
    ├── src/
    │   ├── pages/       # Website content, meta tags
    │   └── assets/      # Logo, branding
    └── package.json

infrastructure/
├── bicep/
│   ├── main.bicep       # Resource names (fundrbolt-app-svc → fundrbolt-app-svc)
│   ├── modules/         # Module names, descriptions
│   └── environments/    # Param files with fundrbolt refs
└── scripts/
    ├── deploy-backend.sh    # Script names, refs
    ├── configure-secrets.sh # Secret names
    └── ...

.github/
├── workflows/           # Fundrbolt refs in workflow names, job names
└── copilot-instructions.md # Project overview text

docs/
├── README.md            # Project description
├── operations/          # Runbooks with Fundrbolt refs
└── features/            # Feature docs with branding

.specify/
├── memory/
│   └── constitution.md  # Update project name reference
└── specs/
    └── 013-fundrbolt-to-fundrbolt/ # This plan
```

**Structure Decision**: Multi-repo rename across backend, multiple frontend applications, infrastructure-as-code, GitHub Actions, and documentation. Rename is primarily textual (strings, identifiers, file/folder names) with minimal code logic changes. Database schema itself needs only config/metadata updates; no data migration required.

## Complexity Tracking

No Constitution Check violations. Rename is low-risk structurally; highest complexity is ensuring exhaustive coverage across 20+ repos/resources and testing the cutover in lower environments before production promotion.

## Next Steps

- **Phase 0 (Research)**: Enumerate all Fundrbolt references across repositories, infrastructure, and GitHub to create a rename checklist.
- **Phase 1 (Design & Contracts)**: Document data model changes (if any), API naming updates, and generate quickstart/execution steps.
- **Phase 2 (Tasks)**: Generate detailed task list for developers, ops, and QA to execute the rename.


| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
