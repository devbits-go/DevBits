#!/bin/bash

# Exit immediately if a command exits with a non-zero status
# (Equivalent to $ErrorActionPreference = "Stop")
set -e

# Get the directory where the script is located
# (Equivalent to Split-Path -Parent $MyInvocation.MyCommand.Path)
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
API_URL="${API_URL:-https://devbits.ddns.net}"
MODE=""
REBUILD=false

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  sudo "$0" "$@"
  exit
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --local-backend)
      MODE="local-clean"
      shift
      ;;
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --rebuild)
      REBUILD=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./run-all.sh [--mode live|local-clean|local-existing] [--api-url <url>] [--rebuild]"
      exit 1
      ;;
  esac
done

resolve_mode() {
  if [[ -n "$MODE" ]]; then
    echo "$MODE"
    return
  fi

  echo "Select backend mode:"
  echo "  1) live           - connect frontend to deployed backend ($API_URL)"
  echo "  2) local-clean    - reset local docker backend to blank-slate then run"
  echo "  3) local-existing - use existing local docker backend without reset"
  read -r -p "Enter 1, 2, or 3 (default 1): " selection

  case "$selection" in
    2) echo "local-clean" ;;
    3) echo "local-existing" ;;
    *) echo "live" ;;
  esac
}

wait_for_local_health() {
  local retries=15
  local sleep_seconds=2
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "http://localhost/health" >/dev/null 2>&1; then
      echo "Local backend is healthy at http://localhost/health"
      return
    fi
    sleep "$sleep_seconds"
  done

  echo "Warning: local backend did not become healthy in time."
}

# Start the Backend
# We use 'cd' inside a subshell () to keep the paths clean
RUN_MODE="$(resolve_mode)"

case "$RUN_MODE" in
  local-clean)
    API_URL="http://localhost"
    echo "Running in local-clean mode (fresh local backend)."
    bash "$ROOT/backend/scripts/reset-deployment-db.sh"
    wait_for_local_health
    ;;
  local-existing)
    API_URL="http://localhost"
    echo "Running in local-existing mode (no reset)."
    pushd "$ROOT/backend" >/dev/null
    if [[ "$REBUILD" == true ]]; then
      docker compose up -d --build
    else
      docker compose up -d
    fi
    popd >/dev/null
    wait_for_local_health
    ;;
  live)
    echo "Running in live mode (safe: no local DB reset)."
    echo "Using deployed backend API: $API_URL"
    ;;
  *)
    echo "Invalid mode: $RUN_MODE"
    echo "Use --mode live|local-clean|local-existing"
    exit 1
    ;;
esac

# Start the Frontend
echo "Starting frontend..."
(
  cd "$ROOT/frontend"
  EXPO_PUBLIC_API_URL="$API_URL" EXPO_PUBLIC_API_FALLBACK_URL="$API_URL" npm run frontend
) &

# Keep the script running until all background processes finish
wait

live_backend_state="unavailable"
if backend_status_output="$(docker compose -f "$ROOT/backend/docker-compose.yml" ps backend 2>/dev/null)"; then
  if echo "$backend_status_output" | grep -q "Up"; then
    live_backend_state="running"
  else
    live_backend_state="not running"
  fi
fi

echo
echo "===== Summary ====="
echo "Action: Run-all workflow executed in mode '$RUN_MODE'"
echo "Updated: Frontend startup and selected backend workflow applied"
echo "Live backend: $live_backend_state"
