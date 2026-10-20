#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: ci-usability-paths-changed.sh <base-sha> <head-sha>" >&2
  exit 2
fi

base_sha="$1"
head_sha="$2"

while IFS= read -r path; do
  case "$path" in
    index.html|index.js|package.json|package-lock.json|tailwind.config.js|vite.config.js|vite.ux.config.js|playwright.ux.config.js|scripts/test-ux.js|scripts/ux-reporter.js)
      echo true
      exit 0
      ;;
  esac

  if [[ "$path" =~ ^(src|public)/.*\.(vue|js|mjs|css|html|json|geojson|svg|png|webp|woff2?)$ ]] ||
    [[ "$path" =~ ^tests/ux/[^/]+\.(js|mjs|ts|json)$ ]]; then
    echo true
    exit 0
  fi
done < <(git diff --name-only "$base_sha" "$head_sha")

echo false
