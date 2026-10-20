#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: ci-paths-changed.sh <base-sha> <head-sha>" >&2
  exit 2
fi

base_sha="$1"
head_sha="$2"
changed_files="$(git diff --name-only "$base_sha" "$head_sha")"

if printf '%s\n' "$changed_files" | grep -E '^(src/|tests/|scripts/|docs/usability-audit\.md$|package(-lock)?\.json$|playwright[^/]*\.(js|mjs|ts)$|vite\.config\.[^/]+$|\.github/workflows/)' >/dev/null; then
  echo true
else
  echo false
fi
