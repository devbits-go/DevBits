#!/usr/bin/env bash
# Script: sync-static.sh
# Does: Copies compliance/static files from backend/api/static (source of truth) to frontend/public.
#       Run this whenever the backend static files change to keep the frontend web build in sync.
# Use: ./sync-static.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$ROOT/backend/api/static"
DST="$ROOT/frontend/public"

FILES=(
  apple-app-site-association
  privacy-policy.html
  account-deletion.html
)

for file in "${FILES[@]}"; do
  src_path="$SRC/$file"
  dst_path="$DST/$file"

  if [[ ! -f "$src_path" ]]; then
    echo "WARNING: Source file not found, skipping: $src_path"
    continue
  fi

  if cmp -s "$src_path" "$dst_path" 2>/dev/null; then
    echo "Up to date: $file"
  else
    cp "$src_path" "$dst_path"
    echo "Synced: $file"
  fi
done

echo "Sync complete."
