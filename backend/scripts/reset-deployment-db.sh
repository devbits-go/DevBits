#!/usr/bin/env bash
set -euo pipefail

KEEP_UPLOADS="${1:-}"

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  sudo "$0" "$@"
  exit
fi

echo "Resetting DevBits deployment database to a blank slate..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing $ROOT_DIR/.env. Create it from backend/.env.example and set strong credentials before resetting." >&2
  exit 1
fi

docker compose down -v --remove-orphans

if [[ "$KEEP_UPLOADS" != "--keep-uploads" ]]; then
  if [[ -d "uploads" ]]; then
    find "uploads" -mindepth 1 -delete
  fi
fi

docker compose up -d --build

echo "Database reset complete. All users and app data are removed."

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
echo "Action: Deployment DB reset executed"
echo "Updated: Database recreated and services rebuilt"
echo "Live backend: $live_backend_state"
