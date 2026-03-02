#!/usr/bin/env bash
set -euo pipefail

# Bulk rename helper for Augeo -> Fundrbolt
# Usage: ./scripts/rename-to-fundrbolt.sh [--dry-run]
# - Dry run lists files containing matches
# - Live mode applies in-place replacements using perl (BSD/GNU compatible)

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

# File filters
EXCLUDE_EXPR=(
  -path "./.git/*" -o
  -path "./node_modules/*" -o
  -path "./.venv/*" -o
  -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o
  -name "*.ico" -o -name "*.pdf" -o -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.eot"
)

mapfile -t FILES < <(find . -type f -not \( "${EXCLUDE_EXPR[@]}" \))

replace_token() {
  local from="$1" to="$2"
  if [[ $DRY_RUN -eq 1 ]]; then
    grep -I -n "${from}" "${FILES[@]}" || true
  else
    perl -pi -e "s/${from}/${to}/g" "${FILES[@]}"
  fi
}

echo "Running $( (( DRY_RUN )) && echo 'dry run' || echo 'live replacements' )"

# Order matters: case-sensitive replacements first
replace_token "Augeo" "Fundrbolt"
replace_token "augeo" "fundrbolt"

echo "Done. $( (( DRY_RUN )) && echo 'No files modified (dry run).')"
