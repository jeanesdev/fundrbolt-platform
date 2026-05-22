#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-}"

# If on a protected branch (main/master), create a feature branch instead.
# Changes must go through a PR — never commit directly to main.
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  if [[ -z "$COMMIT_MESSAGE" ]]; then
    echo "✏️  No COMMIT_MESSAGE env var set."
    echo "    Please enter a commit message (single line), then press Enter:"
    read -r COMMIT_MESSAGE
  fi
  # Slugify the commit message into a branch name
  SLUG=$(echo "$COMMIT_MESSAGE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | tr ' ' '-' | sed 's/-\+/-/g' | sed 's/^-//' | cut -c1-50 | sed 's/-$//')
  BRANCH="feat/${SLUG}"
  echo "🌿 On main — creating feature branch: $BRANCH"
  git checkout -b "$BRANCH"
fi

echo "🚀 Starting publish flow on branch '$BRANCH'..."

echo ""
echo "🧹 Running safe-commit (staging + checks)..."
./scripts/safe-commit.sh

echo ""
echo "📂 Git status after safe-commit:"
git status

# Only commit if there are staged changes
if ! git diff --cached --quiet; then
  echo ""
  if [[ -z "$COMMIT_MESSAGE" ]]; then
    echo "✏️  No COMMIT_MESSAGE env var set."
    echo "    Please enter a commit message (single line), then press Enter:"
    read -r COMMIT_MESSAGE
  fi

  echo ""
  echo "📝 Creating commit:"
  echo "    $COMMIT_MESSAGE"
  git commit -m "$COMMIT_MESSAGE"
  echo "✅ Commit created."
else
  echo ""
  echo "ℹ️ No staged changes to commit. Skipping commit step."
fi

echo ""
echo "⬆️ Pushing branch '$BRANCH' to origin..."
git push -u origin "$BRANCH"
echo "✅ Push complete."

echo ""
echo "🔎 Checking for existing PR for '$BRANCH'..."
PR_NUMBER="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number')"
if [[ -n "$PR_NUMBER" ]]; then
  echo "✅ PR already exists for branch '$BRANCH' (#$PR_NUMBER). Reusing it."
else
  echo "📝 No PR found. Creating a new one..."
  gh pr create --fill --head "$BRANCH"
  PR_NUMBER="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number')"
  echo "✅ PR created (#$PR_NUMBER)."
fi

echo ""
echo "👀 Watching CI checks for PR #$PR_NUMBER..."
if ! gh pr checks "$PR_NUMBER" --watch; then
  echo "ℹ️ No checks reported; skipping watch."
fi
