#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-}"

if [ -z "$BRANCH" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

echo "Running CI-equivalent checks locally..."
pnpm install
pnpm prepublish:ci

echo "Pushing branch '$BRANCH'..."
git push -u origin "$BRANCH"

echo "Ensuring PR exists..."
if ! gh pr view "$BRANCH" &>/dev/null; then
  gh pr create --fill --head "$BRANCH"
fi

echo "Waiting on PR checks..."
gh pr checks "$BRANCH" --watch
echo "All checks completed."
