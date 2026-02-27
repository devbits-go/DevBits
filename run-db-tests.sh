#!/usr/bin/env bash

# Script: run-db-tests.sh
# Does: Recreates isolated local dev DB/backend containers, waits for DB, then runs Go tests in a temporary golang container.
# Use: ./run-db-tests.sh
# DB: devbits_dev via host.docker.internal in compose project devbits-dev-local.
# Ports: backend default :8080, DB default :5433 (DEVBITS_BACKEND_PORT / DEVBITS_DB_PORT override).
# Modes: Frontend=OFF | Backend=only for local test infra | Live stack untouched | Dev/Test data isolated.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
COMPOSE_PROJECT="devbits-dev-local"

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

cd "$ROOT"
docker compose -p "$COMPOSE_PROJECT" -f backend/docker-compose.dev.yml down --volumes --remove-orphans
docker compose -p "$COMPOSE_PROJECT" -f backend/docker-compose.dev.yml up -d --build

echo "Waiting for database readiness..."
for i in $(seq 1 60); do
  if docker compose -p "$COMPOSE_PROJECT" -f backend/docker-compose.dev.yml exec -T db pg_isready -U devbits_dev -d devbits_dev >/dev/null 2>&1; then
    echo "Database is ready."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Error: Database did not become ready within 60 seconds."
    exit 1
  fi
  sleep 1
done

set +e
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e USE_TEST_DB=true \
  -e POSTGRES_TEST_DB=devbits_dev \
  -e POSTGRES_TEST_USER=devbits_dev \
  -e POSTGRES_TEST_PASSWORD=devbits_dev_password \
  -e POSTGRES_TEST_HOST=host.docker.internal \
  -e POSTGRES_TEST_PORT="$DEVBITS_DB_PORT" \
  -v "$ROOT/backend:/app" -w /app/api golang:1.24 bash -c "go test ./..."
TEST_EXIT=$?
set -e

exit $TEST_EXIT