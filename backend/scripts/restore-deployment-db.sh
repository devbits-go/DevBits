#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-backups/db}"

echo "Restoring deployment database from backup..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing $ROOT_DIR/.env. Create it from backend/.env.example and set real values." >&2
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

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

LATEST_FILE="$(ls -1t "$BACKUP_DIR"/devbits-db-*.sql 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST_FILE" ]]; then
  echo "No backup files found in $BACKUP_DIR" >&2
  exit 1
fi

RESOLVED_BACKUP="$LATEST_FILE"

echo "Using backup: $RESOLVED_BACKUP"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 < "$RESOLVED_BACKUP"

db_file_name="$(basename "$RESOLVED_BACKUP")"
db_timestamp="${db_file_name#devbits-db-}"
db_timestamp="${db_timestamp%.sql}"

uploads_tgz="$BACKUP_DIR/devbits-uploads-${db_timestamp}.tar.gz"
uploads_zip="$BACKUP_DIR/devbits-uploads-${db_timestamp}.zip"
uploads_dir="$ROOT_DIR/uploads"
mkdir -p "$uploads_dir"

if [[ -f "$uploads_tgz" ]]; then
  find "$uploads_dir" -mindepth 1 -maxdepth 1 -type f -delete
  tar -xzf "$uploads_tgz" -C "$uploads_dir"
  echo "Uploads restored from: $uploads_tgz"
elif [[ -f "$uploads_zip" ]]; then
  find "$uploads_dir" -mindepth 1 -maxdepth 1 -type f -delete
  unzip -o -q "$uploads_zip" -d "$uploads_dir"
  echo "Uploads restored from: $uploads_zip"
else
  echo "No matching uploads backup found for timestamp $db_timestamp, keeping current uploads directory."
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^devbits-api\.service'; then
  echo "Restarting devbits-api service..."
  sudo systemctl restart devbits-api
fi

echo "Restore complete."

echo
echo "===== Summary ====="
echo "Action: Deployment DB restore executed"
echo "Updated: Database restored and matching uploads restored when available"
echo "Database restore target: DATABASE_URL"
