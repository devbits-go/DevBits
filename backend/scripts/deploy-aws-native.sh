#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing $ROOT_DIR/.env. Create it from backend/.env.example and set real values." >&2
  exit 1
fi

echo "Building backend binary..."
"$ROOT_DIR/scripts/build-backend-linux.sh"

if [[ "$EUID" -eq 0 ]]; then
  "$ROOT_DIR/scripts/install-aws-systemd-service.sh"
else
  sudo "$ROOT_DIR/scripts/install-aws-systemd-service.sh"
fi

echo
echo "===== Summary ====="
echo "Action: Native AWS deploy completed"
echo "Binary: $ROOT_DIR/bin/devbits-api"
echo "Service: ${DEVBITS_SERVICE_NAME:-devbits-api}"
