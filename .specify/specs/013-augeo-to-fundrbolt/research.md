# Phase 0: Research - Fundrbolt to Fundrbolt Rename

**Date**: 2025-12-17
**Feature**: 013-fundrbolt-to-fundrbolt
**Status**: Complete

## Overview

This document consolidates findings on Fundrbolt references across the codebase, infrastructure, GitHub, and Azure resources. It identifies where renaming is required and any migration strategies needed.

---

## Findings

### 1. Source Code References

#### Backend (`/backend`)

**File**: `pyproject.toml`
- **Current**: `name = "fundrbolt-platform"`
- **Decision**: Rename to `fundrbolt-platform`
- **Impact**: Poetry package name; affects virtual environment path and dependency management
- **Rationale**: Keep consistent with frontend package names and project identity

**File**: `app/main.py`
- **Current**: Application title/description contains "Fundrbolt", contact email references Fundrbolt
- **Decision**: Replace with Fundrbolt equivalents
- **Impact**: OpenAPI documentation, API responses
- **Rationale**: User-facing documentation and support continuity

**Files**: `app/core/config.py`, `app/middleware/`.
- **Current**: Configuration variables, logging, response headers may reference Fundrbolt
- **Decision**: Search and replace all brand names
- **Impact**: Runtime configuration, API responses, logs
- **Rationale**: Full branding consistency

#### Frontend Applications

**Directory**: `frontend/fundrbolt-admin`
- **Current**: Folder name `fundrbolt-admin`
- **Decision**: Rename to `fundrbolt-admin`
- **Impact**: Workspace structure, build configs, import paths
- **Rationale**: Align admin tool with product branding

**Files**: `package.json` across all frontends
- **Current**: `"name": "fundrbolt-admin"`, `"description": "..."` with Fundrbolt branding
- **Decision**: Rename to `fundrbolt-admin`, update description
- **Impact**: Package registry, builds, dependencies
- **Rationale**: Consistency with backend package name strategy

**Files**: UI components, pages, assets
- **Current**: Strings like "Fundrbolt Platform", logos, comments
- **Decision**: Replace with Fundrbolt equivalents
- **Impact**: User-visible UI, documentation strings
- **Rationale**: User-facing consistency

**File**: `frontend/*/public/manifest.json`
- **Current**: App name, description with Fundrbolt branding
- **Decision**: Update to Fundrbolt
- **Impact**: PWA metadata, browser install prompts
- **Rationale**: User installation experience

---

### 2. Database & Data Model

**Scope**: No schema changes required.
- **Current State**: No tables or fields storing the product name "Fundrbolt"
- **Decision**: No migrations needed for data; only config/metadata updates
- **Impact**: Zero data migration risk
- **Rationale**: Product name is external branding, not data

**If applicable**: Configuration tables (if any) containing "Fundrbolt"
- **Decision**: Update config values directly or via migration script
- **Impact**: Minimal; likely 1-5 rows
- **Rationale**: Preserve audit trail if using soft-updates

---

### 3. Infrastructure & Azure Resources

#### Azure Resource Naming

**Bicep Templates** (`infrastructure/bicep/`)
- **Current**: Resource names contain `fundrbolt` (e.g., `fundrbolt-app-svc`, `fundrbolt-kv`, `fundrbolt-pg`)
- **Decision**: Rename to `fundrbolt-*` equivalents
- **Impact**: Azure resource identifiers, DNS names, connection strings
- **Rationale**: Infrastructure consistency; requires environment redeploy

**Environment Parameter Files** (`infrastructure/bicep/environments/`)
- **Current**: `*.fundrbolt.bicepparam` files
- **Decision**: Rename to `*.fundrbolt.bicepparam`
- **Impact**: Deployment parameter selection
- **Rationale**: Clearer environment identification

**Key Vault Secrets** (Azure Key Vault)
- **Current**: Secrets may have `fundrbolt-` prefix
- **Decision**: Add new `fundrbolt-` secrets, retire old ones after cutover
- **Impact**: Application configuration, connection strings
- **Rationale**: Safe cutover with easy rollback

#### GitHub Actions & CI/CD

**Workflow Files** (`.github/workflows/`)
- **Current**: Job names, step descriptions, artifact names may reference Fundrbolt
- **Decision**: Replace with Fundrbolt equivalents
- **Impact**: Build logs, artifact naming, clarity
- **Rationale**: Consistency in automation

---

### 4. GitHub Repositories

**Current Repositories**:
- Primary: `jeanesdev/fundrbolt-platform`
- Potential related: May have forks or reference Fundrbolt

**Decision Strategy**:
- Rename primary repo from `fundrbolt-platform` to `fundrbolt-platform` (or similar)
- Update all remote references in local clones and CI/CD
- Preserve git history via GitHub redirect

**Impact**:
- Clone URLs change
- Any hardcoded URLs in docs/scripts need update
- GitHub Actions workflows reference repo name

**Rationale**: Branding alignment; GitHub provides automatic redirects to ease transition

---

### 5. Documentation & Comments

**Files**:
- `README.md` at root and in subdirectories
- `docs/development/`, `docs/operations/`
- Copilot instructions (`.github/copilot-instructions.md`)
- All `.md` files in `.specify/memory/`

**Current**: Extensive references to Fundrbolt as project name/description

**Decision**: Full text search and replace
- Replace "Fundrbolt" → "Fundrbolt"
- Replace "fundrbolt" → "fundrbolt"
- Review context to preserve intent (e.g., "from Fundrbolt to Fundrbolt" explanations)

**Impact**: Clarity for new developers, user-facing guides

**Rationale**: Complete brand transition

---

### 6. Configuration & Constants

**Files**:
- `.env*` templates
- `docker-compose.yml` (service names, labels)
- Makefile (target names, comments)
- `pyproject.toml`, `package.json` (tool configs)

**Current**: May have `AUGEO_*` env vars, service names, build targets

**Decision**: Rename to `FUNDRBOLT_*`, update service labels consistently

**Impact**: Local development environment, Docker builds

**Rationale**: Developer experience and automation clarity

---

### 7. External Integrations & APIs

**Scope**:
- Email service (SendGrid, Azure Communication Services)
- Stripe (metadata, naming)
- Third-party webhooks

**Current**: App/sender name may be "Fundrbolt" in external systems

**Decision**:
- Update sender name in email templates
- Update Stripe metadata/descriptions (if applicable)
- Notify webhook subscribers of potential changes
- No API endpoint changes required (already planned as Fundrbolt-only)

**Impact**: Minimal; mostly text updates

**Rationale**: External consistency

---

## Rename Checklist (High-Level)

### Phase 1: Code & Packages
- [ ] Backend: Update `pyproject.toml`, `app/main.py`, config files
- [ ] Frontend admin: Rename folder `fundrbolt-admin` → `fundrbolt-admin`, update `package.json`
- [ ] Frontend PWAs: Update `package.json`, manifest files, UI strings
- [ ] Shared: Update any shared package names/descriptions
- [ ] Search & replace across all source files for "Fundrbolt" → "Fundrbolt", "fundrbolt" → "fundrbolt"

### Phase 2: Infrastructure
- [ ] Bicep: Rename resource names, parameter files
- [ ] Azure: Deploy updated Bicep templates to each environment
- [ ] GitHub Actions: Update workflow file names, job descriptions

### Phase 3: GitHub & Repos
- [ ] Rename primary repository (if needed by business process)
- [ ] Update local clones, CI/CD remote references
- [ ] Verify automatic GitHub redirects work

### Phase 4: Documentation
- [ ] README files
- [ ] Developer guides
- [ ] Operations runbooks
- [ ] Copilot instructions
- [ ] `.specify/` memory and constitution

### Phase 5: Configuration & Secrets
- [ ] Env vars (local `.env` templates)
- [ ] Docker Compose labels/service names
- [ ] Makefile targets
- [ ] Azure Key Vault: Add new secrets, plan retirement of old ones

### Phase 6: Database (if needed)
- [ ] Create Alembic migration for any config updates
- [ ] Test on staging database
- [ ] Execute on dev first, then staging, then production

### Phase 7: Testing & Cutover
- [ ] Smoke tests on renamed assets (build, start services, load UI)
- [ ] Integration tests (auth, API calls, WebSocket)
- [ ] Verify redirects and legacy references work
- [ ] Final stakeholder signoff

---

## Best Practices Applied

1. **No Backward Compatibility**: Direct cutover; no Fundrbolt aliases maintained (per spec clarification)
2. **Atomic Commits**: Each rename phase packaged as logical commit(s)
3. **Minimal Data Risk**: No schema changes; only string/config updates
4. **Safe Infrastructure**: New Bicep resources with Fundrbolt names; old resources can be retired post-launch
5. **Testing First**: Dry run on dev/staging before production deployment

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Missed references in large codebase | Use automated search scripts; manual review of high-risk areas (API, auth, payment) |
| Broken links in external integrations | Notify integrators; use URL redirects where applicable |
| Database connection strings stale | Update all `.env` files and Azure Key Vault before cutover |
| Webhook endpoints change | Communicate endpoint cutover to subscribers; maintain old endpoints as redirects briefly |
| Docker/build artifacts cache old names | Clean Docker caches; rebuild from scratch post-rename |

---

## Conclusion

All Fundrbolt references are textual/configurational; no algorithmic logic depends on the name. Rename is straightforward and low-risk. Execution can proceed in phases (code → infrastructure → docs → testing) with dry runs at each stage.
