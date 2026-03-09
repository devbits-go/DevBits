#!/usr/bin/env bash
set -euo pipefail

KEEP_UPLOADS="${1:-}"

echo "Resetting DevBits deployment database to a blank slate..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing $ROOT_DIR/.env. Create it from backend/.env.example and set strong credentials before resetting." >&2
  exit 1
fi

set -a
. ./.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL in $ROOT_DIR/.env" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install PostgreSQL client tools first." >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public;"

if [[ "$KEEP_UPLOADS" != "--keep-uploads" ]]; then
  if [[ -d "uploads" ]]; then
    find "uploads" -mindepth 1 -delete
  fi
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^devbits-api\.service'; then
  echo "Restarting devbits-api service to recreate schema and warm startup..."
  sudo systemctl restart devbits-api
fi

echo "Database reset complete. All users and app data are removed."

echo
echo "===== Summary ====="
echo "Action: Deployment DB reset executed"
echo "Updated: Public schema recreated (blank state)"
echo "Database reset target: DATABASE_URL"
