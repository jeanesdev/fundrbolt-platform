#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-}"

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
  PR_NUMBER="$(gh pr create --fill --head "$BRANCH" --json number --jq '.number')"
  echo "✅ PR created (#$PR_NUMBER)."
fi

echo ""
echo "👀 Watching CI checks for PR #$PR_NUMBER..."
gh pr checks "$PR_NUMBER" --watch

echo ""
echo "🔄 Entering extended wait loop until no checks are pending..."

POLL_INTERVAL=20  # seconds

while true; do
  # Get raw checks JSON
  CHECKS_JSON="$(gh pr checks "$PR_NUMBER" --json status,state,name 2>/dev/null || echo "")"

  # If command failed or no checks yet, just sleep and retry
  if [[ -z "$CHECKS_JSON" ]]; then
    echo "ℹ️ No checks information yet. Waiting..."
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Count pending checks
  PENDING_COUNT="$(echo "$CHECKS_JSON" | jq '[.[] | select(.status == "PENDING" or .status == "IN_PROGRESS")] | length')"

  # Optional: count failing checks
  FAILING_COUNT="$(echo "$CHECKS_JSON" | jq '[.[] | select(.state == "FAILURE" or .state == "ERROR")] | length')"

  echo "📊 Current CI summary for PR #$PR_NUMBER: $PENDING_COUNT pending, $FAILING_COUNT failing."

  if [[ "$PENDING_COUNT" -eq 0 ]]; then
    echo "✅ No pending checks remaining."

    if [[ "$FAILING_COUNT" -gt 0 ]]; then
      echo "❌ Some checks failed. See detailed output above or in the PR UI."
      exit 1
    else
      echo "🎉 All checks completed and passing."
      break
    fi
  fi

  echo "⏳ Still waiting on pending checks. Sleeping for $POLL_INTERVAL seconds..."
  sleep "$POLL_INTERVAL"
done

echo ""
echo "✅ Publish flow fully complete; CI is done for PR #$PR_NUMBER."
