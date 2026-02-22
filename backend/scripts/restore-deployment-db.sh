#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-backups/db}"

echo "Restoring deployment database from backup..."

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

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  sudo "$0" "$@"
  exit
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

docker compose exec -T db psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"${DB_NAME}\";"
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < "$RESOLVED_BACKUP"

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

echo "Restore complete. Rebuilding deployment services..."
docker compose up -d --build

echo "Restore complete and services rebuilt."

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
echo "Action: Deployment DB restore executed"
echo "Updated: Database restored and matching uploads restored when available; services rebuilt"
echo "Live backend: $live_backend_state"
