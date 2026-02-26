#!/bin/bash

set -e

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR="$ROOT/backend"

API_PORT="${API_PORT:-8080}"

cleanup() {
  echo ""
  echo "=== Shutting down local development environment ==="
  
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    echo "Stopped backend (PID: $BACKEND_PID)"
  fi
  
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    echo "Stopped frontend"
  fi
  
  if [ -n "$TEST_DB_STARTED" ]; then
    echo "Test database is still running (data preserved)."
  fi
  
  if [ -n "$PROD_DB_STOPPED" ]; then
    echo "Restarting production Docker containers..."
    docker compose -f "$BACKEND_DIR/docker-compose.yml" start 2>/dev/null || true
    echo "Production containers restarted"
  fi
  
  echo "Cleanup complete."
  exit 0
}

trap cleanup SIGINT SIGTERM

if [[ -z "${API_URL:-}" ]]; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z "$LAN_IP" ]]; then
    LAN_IP="localhost"
  fi
  API_URL="http://$LAN_IP:$API_PORT"
fi

echo "=== DevBits Local Development Environment ==="
echo "API URL: $API_URL"
echo ""

echo "Step 1/4: Checking for production Docker containers on port $API_PORT..."
if docker compose -f "$BACKEND_DIR/docker-compose.yml" ps backend 2>/dev/null | grep -q "Up"; then
  echo "Stopping production Docker containers (to free port $API_PORT)..."
  docker compose -f "$BACKEND_DIR/docker-compose.yml" down 2>/dev/null || true
  PROD_DB_STOPPED=1
  echo "Production containers stopped."
else
  echo "No production containers running on port $API_PORT."
fi
echo ""

echo "Step 2/4: Starting test database..."
docker compose -f "$BACKEND_DIR/docker-compose.test.yml" --env-file "$BACKEND_DIR/.env.test" up -d
TEST_DB_STARTED=1

echo "Waiting for test database to be ready..."
sleep 3

MAX_ATTEMPTS=15
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if docker compose -f "$BACKEND_DIR/docker-compose.test.yml" --env-file "$BACKEND_DIR/.env.test" exec -T test-db pg_isready -U testuser -d devbits_test > /dev/null 2>&1; then
    echo "Test database is ready!"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "Waiting for database... ($ATTEMPT/$MAX_ATTEMPTS)"
  sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "Warning: Test database may not be ready, continuing anyway..."
fi
echo ""

# Seed database if needed
echo "Checking for existing test data..."
USER_COUNT=$(docker exec devbits-test-db psql -U testuser -d devbits_test -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
if [ "$USER_COUNT" -lt 5 ]; then
  echo "Seeding test database with data..."
  docker exec -i devbits-test-db psql -U testuser -d devbits_test < "$BACKEND_DIR/api/internal/database/create_tables.sql" > /dev/null 2>&1 || true
  docker exec -i devbits-test-db psql -U testuser -d devbits_test < "$BACKEND_DIR/api/internal/database/create_test_data.sql" > /dev/null 2>&1 || true
  echo "Test data seeded."
else
  echo "Test data already exists ($USER_COUNT users found)."
fi
echo ""

echo "Step 3/4: Starting local backend..."
cd "$BACKEND_DIR"

# Load environment variables
if [ -f .env.test ]; then
  echo "Loading .env.test..."
  set -a
  source .env.test
  set +a
fi

export USE_TEST_DB=true
export POSTGRES_TEST_DB="${POSTGRES_TEST_DB:-devbits_test}"
export POSTGRES_TEST_USER="${POSTGRES_TEST_USER:-testuser}"
export POSTGRES_TEST_PASSWORD="${POSTGRES_TEST_PASSWORD:-testpass123}"

echo "Using database: postgres://${POSTGRES_TEST_USER}:****@127.0.0.1:5432/${POSTGRES_TEST_DB}"

go run ./api &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
echo "Waiting for backend to be ready..."
sleep 3
echo ""

echo "Step 4/4: Starting frontend..."
echo ""
cd "$ROOT/frontend"
EXPO_PUBLIC_USE_LOCAL_API="1" EXPO_PUBLIC_API_URL="$API_URL" EXPO_PUBLIC_API_FALLBACK_URL="$API_URL" npm run frontend &
FRONTEND_PID=$!

echo ""
echo "=== Local Development Environment Running ==="
echo "Backend:   http://localhost:$API_PORT"
echo "Frontend:  Scan QR code with Expo Go"
echo ""
echo "Press Ctrl+C to stop all services and restore production Docker containers."
echo ""

wait
