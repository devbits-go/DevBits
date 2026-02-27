#!/usr/bin/env bash

# Script: run-dev.sh
# Does: Boots local dev DB + local backend (isolated compose project), then launches frontend in local mode.
# Use: ./run-dev.sh [--clear]
# DB: devbits_dev (user/pass: devbits_dev/devbits_dev_password) in compose project devbits-dev-local.
# Ports: backend default :8080, DB default :5433 (DEVBITS_BACKEND_PORT / DEVBITS_DB_PORT override).
# Modes: Frontend=ON(local API) | Backend=ON(local Docker) | Live stack untouched | Test DB untouched.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
COMPOSE_PROJECT="devbits-dev-local"

CLEAR_FRONTEND=""
if [[ "${1:-}" == "--clear" ]]; then
  CLEAR_FRONTEND="--clear"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is required."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Compose v2 is required."
  exit 1
fi

is_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${port}" | grep -q LISTEN
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  netstat -an 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -qi LISTEN
}

resolve_port() {
  local label="$1"
  local default_port="$2"
  local chosen="$default_port"

  while is_port_in_use "$chosen"; do
    echo "Port ${chosen} is already in use for ${label}."
    read -r -p "Enter alternate port for ${label} (blank to exit): " chosen
    if [[ -z "$chosen" ]]; then
      echo "Exiting. Free port ${default_port} or choose an alternate port next run."
      exit 1
    fi
    if ! [[ "$chosen" =~ ^[0-9]+$ ]] || (( chosen < 1 || chosen > 65535 )); then
      echo "Invalid port: ${chosen}"
      chosen="$default_port"
    fi
  done

  echo "$chosen"
}

DEVBITS_BACKEND_PORT="$(resolve_port "backend" 8080)"
DEVBITS_DB_PORT="$(resolve_port "postgres" 5433)"
export DEVBITS_BACKEND_PORT
export DEVBITS_DB_PORT

echo "Using backend port ${DEVBITS_BACKEND_PORT} and db port ${DEVBITS_DB_PORT}."

cd "$BACKEND_DIR"
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.dev.yml down --volumes --remove-orphans
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.dev.yml up -d --build

echo "Waiting for database readiness..."
for i in $(seq 1 60); do
  if docker compose -p "$COMPOSE_PROJECT" -f docker-compose.dev.yml exec -T db pg_isready -U devbits_dev -d devbits_dev >/dev/null 2>&1; then
    echo "Database is ready."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Error: Database did not become ready within 60 seconds."
    exit 1
  fi
  sleep 1
done

echo "Waiting for backend health check..."
for i in $(seq 1 60); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://localhost:${DEVBITS_BACKEND_PORT}/health" >/dev/null 2>&1; then
      echo "Backend is healthy."
      break
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -q -O /dev/null "http://localhost:${DEVBITS_BACKEND_PORT}/health"; then
      echo "Backend is healthy."
      break
    fi
  fi

  if [[ "$i" -eq 60 ]]; then
    echo "Error: Backend did not become healthy within 60 seconds."
    docker compose -p "$COMPOSE_PROJECT" -f docker-compose.dev.yml logs backend --tail 100
    exit 1
  fi
  sleep 1
done

echo "Launching frontend in local backend mode..."
cd "$ROOT"
EXPO_PUBLIC_LOCAL_API_PORT="$DEVBITS_BACKEND_PORT" "$ROOT/run-front.sh" --local $CLEAR_FRONTEND