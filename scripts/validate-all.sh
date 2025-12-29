#!/bin/bash
# Comprehensive validation script - runs all checks before pushing
# Usage: ./scripts/validate-all.sh

set -e

echo "🔍 Running comprehensive validation checks..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Python backend checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐍 Backend (Python)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if cd backend && poetry run ruff check . && poetry run black --check . && poetry run mypy app; then
    echo -e "${GREEN}✅ Backend validation passed${NC}"
else
    echo -e "${RED}❌ Backend validation failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
cd ..
echo ""

# 2. Frontend checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚛️  Frontend (TypeScript/React)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if cd frontend/fundrbolt-admin && pnpm lint && pnpm type-check; then
    echo -e "${GREEN}✅ Frontend validation passed${NC}"
else
    echo -e "${RED}❌ Frontend validation failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
cd ../..
echo ""

# 3. Bicep template validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  Infrastructure (Bicep)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BICEP_ERRORS=0
for file in infrastructure/bicep/*.bicep infrastructure/bicep/modules/*.bicep; do
    if [ -f "$file" ]; then
        echo "Validating $file..."
        if ! az bicep build --file "$file" > /dev/null 2>&1; then
            echo -e "${RED}❌ Failed: $file${NC}"
            az bicep build --file "$file" || true
            BICEP_ERRORS=$((BICEP_ERRORS + 1))
        fi
    fi
done

if [ $BICEP_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Bicep validation passed${NC}"
else
    echo -e "${RED}❌ Bicep validation failed ($BICEP_ERRORS files)${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo ""
    echo "Safe to push to remote repository."
    exit 0
else
    echo -e "${RED}❌ $ERRORS validation check(s) failed${NC}"
    echo ""
    echo "Please fix the errors above before pushing."
    exit 1
fi
