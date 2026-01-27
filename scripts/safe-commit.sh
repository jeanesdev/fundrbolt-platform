#!/bin/bash
# Pre-commit validation script that runs hooks with auto-retry
# Usage: ./scripts/safe-commit.sh

MAX_ATTEMPTS=3
ATTEMPT=1

echo "📝 Staging all changes..."
git add -A

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo ""
    echo "🔍 Running pre-commit hooks (attempt $ATTEMPT/$MAX_ATTEMPTS)..."

    # Run pre-commit hooks (allow it to fail, we'll check status)
    if pre-commit run --all-files; then
        echo ""
        echo "🧪 Running backend mypy (strict)..."
        if ! (cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'); then
            echo ""
            echo "❌ mypy failed. Fix type errors before committing."
            exit 1
        fi

        echo ""
        echo "🧹 Running ruff format check..."
        if ! (cd backend && poetry run ruff format --check .); then
            echo ""
            echo "❌ Ruff format check failed. Run: poetry run ruff format ."
            exit 1
        fi

        # All hooks passed!
        echo ""
        echo "✅ All pre-commit checks passed!"
        echo "Ready to commit. Run: git commit -m \"your message\""
        exit 0
    else
        # Hooks failed or made changes
        echo ""

        # Check if there are unstaged changes (hooks auto-fixed something)
        if ! git diff --quiet --exit-code; then
            echo "✨ Pre-commit hooks made auto-fixes"
            echo "📝 Re-staging modified files..."
            git add -A
            ATTEMPT=$((ATTEMPT + 1))

            if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
                echo "� Will retry with fixes applied..."
            fi
        else
            # Hooks failed but made no changes - manual intervention needed
            echo ""
            echo "❌ Pre-commit hooks failed with errors that cannot be auto-fixed."
            echo "Please review the errors above and fix them manually."
            exit 1
        fi
    fi
done

echo ""
echo "❌ Failed to pass pre-commit hooks after $MAX_ATTEMPTS attempts."
echo "This shouldn't happen - please investigate."
exit 1
