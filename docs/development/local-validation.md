# Local Validation Guide

This guide explains how to validate your code locally before pushing to avoid CI/CD failures.

## Quick Commands

### Validate Everything (Recommended before pushing)
```bash
./scripts/validate-all.sh
```
This runs all validation checks: Python, TypeScript, and Bicep.

### Run Pre-commit Hooks
```bash
make check-commits
# or
./scripts/safe-commit.sh
```

### Individual Checks

**Backend (Python):**
```bash
cd backend
poetry run ruff check .
poetry run black --check .
poetry run mypy app
poetry run pytest
```

**Frontend (TypeScript/React):**
```bash
cd frontend/fundrbolt-admin
pnpm lint
pnpm type-check
pnpm test
```

**Infrastructure (Bicep):**
```bash
# Validate all templates
for file in infrastructure/bicep/*.bicep infrastructure/bicep/modules/*.bicep; do
    az bicep build --file "$file"
done
```

## Pre-commit Hook Coverage

The pre-commit hooks (run automatically on `git commit` or via `make check-commits`) now validate:

### ✅ Always Validated
- **Python**: Ruff linting, Black formatting, MyPy type checking
- **General**: Trailing whitespace, end-of-file, YAML/JSON syntax
- **Frontend**: ESLint, TypeScript type checking
- **Bicep**: Template syntax validation

### ⚠️ Not in Pre-commit (Run manually)
- **Backend tests**: `cd backend && poetry run pytest`
- **Frontend tests**: `cd frontend/fundrbolt-admin && pnpm test`
- **Frontend build**: `cd frontend/fundrbolt-admin && pnpm build`

## Common Issues

### ESLint Errors
- **Unused variables**: Prefix with `_` (e.g., `_error`)
- **console.log**: Remove or replace with proper logging
- **any types**: Use proper TypeScript types
- **React Hooks**: Must be in component functions (PascalCase)

### Bicep Errors
- **utcNow()**: Can only be used in parameter defaults
- **Unused parameters**: Remove or use in resource definitions
- **Null safety**: Use `!` operator for conditional module outputs
- **Scope errors**: Ensure module scope matches resource type

### MyPy Errors
- Check `backend/pyproject.toml` for mypy configuration
- Exclude tests: `--exclude=app/tests/`
- Add type hints to function signatures

## Workflow Recommendation

1. **Make changes**
2. **Run validation**: `./scripts/validate-all.sh`
3. **Fix any errors**
4. **Stage changes**: `git add -A`
5. **Run pre-commit**: `make check-commits`
6. **Commit**: `git commit -m "your message"`
7. **Push**: `git push`

This ensures CI/CD checks will pass on the first try!
