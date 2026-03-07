#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Please run as root"
  sudo "$0" "$@"
  exit
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_NAME="${DEVBITS_SERVICE_NAME:-devbits-api}"
SERVICE_USER="${DEVBITS_SERVICE_USER:-${SUDO_USER:-ubuntu}}"
WORK_DIR="${DEVBITS_WORKDIR:-$ROOT_DIR}"
ENV_FILE="${DEVBITS_ENV_FILE:-$WORK_DIR/.env}"
BINARY_PATH="${DEVBITS_BINARY_PATH:-$WORK_DIR/bin/devbits-api}"
TEMPLATE_PATH="$ROOT_DIR/deploy/systemd/devbits-api.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Create it from backend/.env.example before installing service." >&2
  exit 1
fi

if [[ ! -x "$BINARY_PATH" ]]; then
  echo "Missing executable binary: $BINARY_PATH" >&2
  echo "Run ./scripts/build-backend-linux.sh first." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Missing systemd service template: $TEMPLATE_PATH" >&2
  echo "Ensure the deploy/systemd/devbits-api.service template is present." >&2
  exit 1
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "Service user does not exist: $SERVICE_USER" >&2
  exit 1
fi

tmp_service="$(mktemp)"
trap 'rm -f "$tmp_service"' EXIT

sed \
  -e "s|__SERVICE_USER__|$SERVICE_USER|g" \
  -e "s|__WORKDIR__|$WORK_DIR|g" \
  -e "s|__ENV_FILE__|$ENV_FILE|g" \
  -e "s|__BINARY_PATH__|$BINARY_PATH|g" \
  "$TEMPLATE_PATH" > "$tmp_service"

install -m 0644 "$tmp_service" "$SERVICE_PATH"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "Service installed: $SERVICE_PATH"
systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,25p'
