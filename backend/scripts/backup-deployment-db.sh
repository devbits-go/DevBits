#!/usr/bin/env bash
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  sudo "$0" "$@"
  exit
fi

BACKUP_DIR="${1:-backups/db}"

echo "Creating deployment database backup..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env" ]]; then
  set -a
  . ./.env
  set +a
fi

DB_USER="${POSTGRES_USER:-devbits}"
DB_NAME="${POSTGRES_DB:-devbits}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
DB_BACKUP_FILE_NAME="devbits-db-${TIMESTAMP}.sql"
DB_OUTPUT_FILE="${BACKUP_DIR}/${DB_BACKUP_FILE_NAME}"

docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$DB_OUTPUT_FILE"

if [[ ! -s "$DB_OUTPUT_FILE" ]]; then
  echo "Database backup file is empty or missing. Aborting." >&2
  exit 1
fi
echo "Database backup created: $DB_OUTPUT_FILE"

UPLOADS_DIR="uploads"
UPLOADS_BACKUP_FILE_NAME="devbits-uploads-${TIMESTAMP}.tar.gz"
UPLOADS_OUTPUT_FILE="${BACKUP_DIR}/${UPLOADS_BACKUP_FILE_NAME}"

if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$UPLOADS_OUTPUT_FILE" -C "$UPLOADS_DIR" .
  echo "Uploads backup created: $UPLOADS_OUTPUT_FILE"
else
  echo "Uploads directory not found, skipping backup."
fi

# Retention: keep only the latest db backup and the latest uploads backup
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devbits-db-*.sql' | sort | head -n -1 | xargs -r rm
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devbits-uploads-*.tar.gz' | sort | head -n -1 | xargs -r rm

echo "Retention applied: only latest backup of each type is kept."

live_backend_state="unavailable"
if backend_status_output="$(docker compose ps backend 2>/dev/null)"; then
  if echo "$backend_status_output" | grep -q "Up"; then
    live_backend_state="running"
  else
    live_backend_state="not running"
  fi
fi

echo
echo "===== Summary ====="
echo "Action: Deployment backup created"
echo "Updated: Latest DB + uploads backup files retained"
echo "Live backend: $live_backend_state"
