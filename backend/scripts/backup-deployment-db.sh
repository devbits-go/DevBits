#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${1:-backups/db}"

echo "Creating deployment database backup..."

if [[ ! -f ".env" ]]; then
  echo "Missing $ROOT_DIR/.env. Create it from backend/.env.example and set DATABASE_URL." >&2
  exit 1
fi

set -a
. ./.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL in $ROOT_DIR/.env" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required. Install PostgreSQL client tools first." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
DB_BACKUP_FILE_NAME="devbits-db-${TIMESTAMP}.sql"
DB_OUTPUT_FILE="${BACKUP_DIR}/${DB_BACKUP_FILE_NAME}"

pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$DB_OUTPUT_FILE"

if [[ ! -s "$DB_OUTPUT_FILE" ]]; then
  echo "Database backup file is empty or missing. Aborting." >&2
  exit 1
fi

echo "Database backup created: $DB_OUTPUT_FILE"

UPLOADS_DIR="uploads"
UPLOADS_BACKUP_FILE_NAME="devbits-uploads-${TIMESTAMP}.tar.gz"
UPLOADS_OUTPUT_FILE="${BACKUP_DIR}/${UPLOADS_BACKUP_FILE_NAME}"

if [[ -d "$UPLOADS_DIR" ]]; then
  tar -czf "$UPLOADS_OUTPUT_FILE" -C "$UPLOADS_DIR" .
  echo "Uploads backup created: $UPLOADS_OUTPUT_FILE"
else
  echo "Uploads directory not found, skipping backup."
fi

# Retention: keep only the latest DB backup and latest uploads backup.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devbits-db-*.sql' | sort | head -n -1 | xargs -r rm
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devbits-uploads-*.tar.gz' | sort | head -n -1 | xargs -r rm

echo "Retention applied: only latest backup of each type is kept."

echo
echo "===== Summary ====="
echo "Action: Deployment backup created"
echo "Updated: Latest DB + uploads backup files retained"
echo "Database backup target: DATABASE_URL"
