# Phase 1: Quickstart - Fundrbolt to Fundrbolt Rename Execution

**Date**: 2025-12-17
**Feature**: 013-fundrbolt-to-fundrbolt
**Status**: Complete

## Quick Reference: Rename Steps

This quickstart provides a step-by-step walkthrough to execute the Fundrbolt → Fundrbolt rename with minimal risk.

---

## Prerequisites

- All team members on branch `013-fundrbolt-to-fundrbolt`
- Local repos freshly cloned/pulled
- Azure CLI authenticated (`az login`)
- GitHub CLI authenticated (`gh auth login`)
- Docker running locally (for dry-run tests)

---

## Step 1: Code Rename (Dev Environment)

### 1.1 Backend Package & Config

**Location**: `/backend`

**Commands**:
```bash
# Update pyproject.toml
sed -i 's/name = "fundrbolt-platform"/name = "fundrbolt-platform"/' pyproject.toml

# Search for Fundrbolt references in Python files
grep -r "Fundrbolt" app/ | head -20  # Review manually
grep -r "fundrbolt" app/ | head -20  # Review manually

# Replace in app/main.py
sed -i 's/Fundrbolt Platform/Fundrbolt Platform/g' app/main.py
sed -i 's/fundrbolt.com/fundrbolt.com/g' app/main.py

# Update app/core/config.py (manual review recommended)
# Look for PROJECT_NAME, PROJECT_DESCRIPTION, CONTACT_EMAIL
```

**Manual Review**:
- Open `app/core/config.py` and update constants
- Open `app/main.py` and verify FastAPI instantiation looks correct

### 1.2 Frontend: Admin Application

**Location**: `/frontend/fundrbolt-admin`

**Commands**:
```bash
# Rename directory
mv frontend/fundrbolt-admin frontend/fundrbolt-admin

# Update package.json
cd frontend/fundrbolt-admin
sed -i 's/"name": "fundrbolt-admin"/"name": "fundrbolt-admin"/' package.json
sed -i 's/Fundrbolt Admin/Fundrbolt Admin/g' package.json

# Search for Fundrbolt in source
grep -r "Fundrbolt" src/ | head -20  # Review
grep -r "fundrbolt" src/ | head -20  # Review

# Replace common strings
find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) \
  -exec sed -i 's/Fundrbolt/Fundrbolt/g' {} +

# Update manifest.json
sed -i 's/Fundrbolt Admin/Fundrbolt Admin/g' public/manifest.json
sed -i 's/Fundrbolt/Fundrbolt/g' public/manifest.json
```

### 1.3 Frontend: PWAs (Donor, Landing)

**Location**: `/frontend/donor-pwa`, `/frontend/landing-site`

**Commands**:
```bash
# For each PWA:
cd frontend/donor-pwa (or landing-site)

sed -i 's/Fundrbolt/Fundrbolt/g' package.json
sed -i 's/Fundrbolt/Fundrbolt/g' public/manifest.json

find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) \
  -exec sed -i 's/Fundrbolt/Fundrbolt/g' {} +

find public -type f \( -name "*.html" -o -name "*.json" \) \
  -exec sed -i 's/Fundrbolt/Fundrbolt/g' {} +
```

### 1.4 Update Build & Config Files

**Files**:
- `.env.example`, `.env.local` (if exists)
- `docker-compose.yml`
- `Makefile` (comments, target descriptions)
- `pyproject.toml` (description field)
- `pnpm-workspace.yaml`

**Commands**:
```bash
# Root level
sed -i 's/fundrbolt/fundrbolt/g' docker-compose.yml
sed -i 's/Fundrbolt/Fundrbolt/g' Makefile
sed -i 's/fundrbolt/fundrbolt/g' .env.example

# Update workspace package names references
sed -i 's/fundrbolt-admin/fundrbolt-admin/g' pnpm-workspace.yaml

cd backend
sed -i 's/fundrbolt/fundrbolt/g' pyproject.toml
sed -i 's/Fundrbolt/Fundrbolt/g' README.md
```

---

## Step 2: Infrastructure Rename (IaC)

### 2.1 Bicep Templates

**Location**: `/infrastructure/bicep/`

**Commands**:
```bash
cd infrastructure

# Rename parameter files
for file in bicep/environments/*.bicepparam; do
  newfile=$(echo "$file" | sed 's/fundrbolt/fundrbolt/g')
  [ "$file" != "$newfile" ] && mv "$file" "$newfile"
done

# Update resource names in bicep files
find bicep -name "*.bicep" -exec sed -i 's/fundrbolt-/fundrbolt-/g' {} +
find bicep -name "*.bicep" -exec sed -i 's/'Fundrbolt'/'Fundrbolt'/g' {} +

# Verify param files reference new names
grep -r "fundrbolt" bicep/environments/ | head -5
```

### 2.2 Azure Key Vault Secrets

**Commands** (manual for safety):
```bash
# List current secrets
az keyvault secret list --vault-name fundrbolt-kv --query "[].name" -o tsv

# For each secret, create new Fundrbolt version:
# az keyvault secret set --vault-name fundrbolt-kv --name fundrbolt-db-password --value <value>

# Plan retirement of old secrets (do NOT delete immediately)
```

---

## Step 3: GitHub & Repo Rename

### 3.1 GitHub Repository (if business requires)

**Manual Steps** (via GitHub UI or CLI):
```bash
# Using GitHub CLI
gh repo rename fundrbolt-platform --confirm

# Verify automatic redirect works
git remote -v  # Should still show old URL
git fetch  # Should follow redirect
```

### 3.2 Update Local Remotes (if repo was renamed)

```bash
# If repo was renamed:
git remote set-url origin https://github.com/jeanesdev/fundrbolt-platform.git
```

### 3.3 Update GitHub Actions Workflows

**Location**: `.github/workflows/`

**Commands**:
```bash
cd .github/workflows

# Update job names, artifact names, comments
for file in *.yml *.yaml; do
  sed -i 's/fundrbolt/fundrbolt/g' "$file"
  sed -i 's/Fundrbolt/Fundrbolt/g' "$file"
done

# Verify workflow syntax
gh workflow list
```

---

## Step 4: Documentation & Comments

### 4.1 Root Documentation

**Files**: `README.md`, `.github/copilot-instructions.md`

**Commands**:
```bash
cd /home/jjeanes/fundrbolt-platform

# Root README
sed -i 's/Fundrbolt/Fundrbolt/g' README.md
sed -i 's/fundrbolt/fundrbolt/g' README.md

# Copilot instructions
sed -i 's/Fundrbolt/Fundrbolt/g' .github/copilot-instructions.md

# Project constitution
sed -i 's/Fundrbolt/Fundrbolt/g' .specify/memory/constitution.md
```

### 4.2 Docs Directory

**Commands**:
```bash
find docs -type f -name "*.md" \
  -exec sed -i 's/Fundrbolt/Fundrbolt/g' {} + \
  -exec sed -i 's/fundrbolt/fundrbolt/g' {} +
```

### 4.3 Developer & Operations Guides

**Files to review manually**:
- `docs/development/*.md`
- `docs/operations/*.md`
- Any runbooks or procedures

---

## Step 5: Build & Test (Dry Run)

### 5.1 Local Build Verification

**Backend**:
```bash
cd backend
poetry install
poetry run pytest tests/ -v --tb=short

# Verify OpenAPI docs
poetry run uvicorn app.main:app --reload &
# Visit http://localhost:8000/docs and verify branding
```

**Frontend**:
```bash
cd frontend/fundrbolt-admin
pnpm install
pnpm build

# Check dist folder exists and assets are processed
ls -la dist/ | head -10
```

### 5.2 Docker Compose Test

```bash
cd /home/jjeanes/fundrbolt-platform
docker-compose build
docker-compose up -d

# Verify services start
docker-compose ps

# Health check
curl http://localhost:8000/health

# Stop
docker-compose down
```

### 5.3 Smoke Tests

```bash
# After docker-compose up:

# Test API
curl -X GET http://localhost:8000/api/v1/events -H "Authorization: Bearer <token>"

# Test UI load (if frontend running)
curl -s http://localhost:3000 | head -20  # Check for Fundrbolt branding

# Test WebSocket (if applicable)
# Manual test with browser dev tools
```

---

## Step 6: Commit & Push

### 6.1 Staging Commits

Create logical, atomic commits:

```bash
git add backend/pyproject.toml backend/app/
git commit -m "refactor(branding): rename fundrbolt to fundrbolt in backend"

git add frontend/fundrbolt-admin frontend/donor-pwa frontend/landing-site
git commit -m "refactor(branding): rename fundrbolt to fundrbolt in frontend"

git add infrastructure/
git commit -m "refactor(branding): rename fundrbolt to fundrbolt in infrastructure"

git add docs/ .github/ README.md
git commit -m "docs(branding): rename fundrbolt to fundrbolt in documentation"

git add .specify/
git commit -m "docs(branding): update specification context for fundrbolt"
```

### 6.2 Pre-commit Checks

```bash
# Run linters before push
make check-commits

# If linting fails, auto-fix:
make format-backend
make format-frontend
```

### 6.3 Push to Feature Branch

```bash
git push origin 013-fundrbolt-to-fundrbolt
```

---

## Step 7: PR & Code Review

### 7.1 Create Pull Request

```bash
gh pr create \
  --title "Rename: Fundrbolt to Fundrbolt" \
  --body "Comprehensive brand rename across all source, infrastructure, and documentation. No functional changes; pre-production state allows immediate cutover. See spec at .specify/specs/013-fundrbolt-to-fundrbolt/spec.md" \
  --base main \
  --head 013-fundrbolt-to-fundrbolt
```

### 7.2 Code Review Checklist

- [ ] All Fundrbolt references replaced with Fundrbolt (search both cases)
- [ ] Package names, folder names, resource names updated
- [ ] Tests pass (backend pytest, frontend build)
- [ ] Docker compose still starts cleanly
- [ ] OpenAPI docs display Fundrbolt branding
- [ ] No functional logic changed (diff shows only text/naming)
- [ ] Commit messages follow Conventional Commits format

---

## Step 8: Dry Run on Staging

### 8.1 Deploy to Staging Environment

```bash
# Merge PR to staging branch or deploy directly
git checkout main
git pull origin main

# Deploy using infrastructure scripts (example)
cd infrastructure
./scripts/deploy-backend.sh --environment staging --tag v1.0.0-fundrbolt

# Wait for deployment
az containerapp show --resource-group fundrbolt-staging --name fundrbolt-api-staging
```

### 8.2 Smoke Tests on Staging

```bash
# Test staging API
curl -X GET https://staging-api.fundrbolt.com/health

# Test UI
curl -s https://staging.fundrbolt.com | grep -i fundrbolt

# Manual browser tests:
# - Navigate to staging UI
# - Verify headers, footers show Fundrbolt
# - Check emails contain Fundrbolt branding
# - Verify no 404s or broken links
```

---

## Step 9: Final Verification & Cutover

### 9.1 Cutover Approval Checklist

- [ ] All tests pass on staging
- [ ] No unplanned Fundrbolt references remain
- [ ] Customer & partner communications sent
- [ ] Support team trained on new branding
- [ ] Monitoring dashboards updated (show Fundrbolt resources)
- [ ] Stakeholder sign-off received

### 9.2 Merge to Main & Deploy to Production

```bash
# If using GitHub web UI for merge (preferred for audit trail)
# OR via CLI:
git checkout main
git pull origin main
gh pr merge 013-fundrbolt-to-fundrbolt --merge

# Verify merge
git log --oneline | head -5
```

### 9.3 Production Deployment

```bash
# Deploy production infrastructure
cd infrastructure
./scripts/deploy-backend.sh --environment production --tag v1.0.0
./scripts/deploy-frontend.sh --environment production --tag v1.0.0

# Monitor deployment
az containerapp logs show --resource-group fundrbolt-prod --name fundrbolt-api-prod --follow
```

### 9.4 Post-Launch Monitoring

- [ ] API responds with Fundrbolt branding in headers
- [ ] UI loads correctly
- [ ] No elevated error rates
- [ ] Customer feedback collected

---

## Rollback Plan (if needed)

### Fast Rollback (Pre-Production Safe)

```bash
# Revert to previous commit
git revert HEAD --no-edit
git push origin 013-fundrbolt-to-fundrbolt

# Rebuild & redeploy old infrastructure
az containerapp update --resource-group fundrbolt-prod \
  --name fundrbolt-api-prod \
  --image old-image:tag
```

---

## Success Criteria

✅ All visible references show "Fundrbolt"
✅ API & infrastructure function without errors
✅ No unplanned downtime
✅ All tests pass
✅ Stakeholder sign-off recorded

---

## Contacts & Escalation

| Role | Contact | Responsibility |
|------|---------|-----------------|
| Developer | [Dev] | Execute code changes, testing |
| Ops | [Ops] | Infrastructure deployment, monitoring |
| Product | [Product] | Stakeholder approval, communications |
| Support | [Support] | Customer support during cutover |

---

## Appendix: Automated Rename Script (Optional)

If you prefer a bulk rename approach, create `/scripts/rename-to-fundrbolt.sh`:

```bash
#!/bin/bash
# Bulk rename script (USE WITH CAUTION)

REPO_ROOT="/home/jjeanes/fundrbolt-platform"
cd "$REPO_ROOT"

echo "=== Starting Fundrbolt → Fundrbolt Rename ==="

# Backend
echo "Renaming backend..."
cd backend
sed -i 's/Fundrbolt/Fundrbolt/g' pyproject.toml
find app -type f -name "*.py" -exec sed -i 's/Fundrbolt/Fundrbolt/g; s/fundrbolt/fundrbolt/g' {} +
cd ..

# Frontend
echo "Renaming frontend..."
mv frontend/fundrbolt-admin frontend/fundrbolt-admin
find frontend -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.json" -o -name "*.md" \) \
  -exec sed -i 's/Fundrbolt/Fundrbolt/g; s/fundrbolt/fundrbolt/g' {} +

# Infrastructure
echo "Renaming infrastructure..."
find infrastructure -type f \( -name "*.bicep" -o -name "*.bicepparam" \) \
  -exec sed -i 's/Fundrbolt/Fundrbolt/g; s/fundrbolt/fundrbolt/g' {} +

# Docs
echo "Renaming documentation..."
find docs .github -type f -name "*.md" -exec sed -i 's/Fundrbolt/Fundrbolt/g; s/fundrbolt/fundrbolt/g' {} +

# Root
sed -i 's/Fundrbolt/Fundrbolt/g' README.md docker-compose.yml

echo "=== Rename Complete ==="
echo "Next: Review changes, run tests, commit."
```

**Usage**:
```bash
chmod +x scripts/rename-to-fundrbolt.sh
scripts/rename-to-fundrbolt.sh
git diff --stat  # Review changes
```

---
