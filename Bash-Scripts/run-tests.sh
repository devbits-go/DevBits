#!/bin/bash
# Script: run-tests.sh
# Does: Starts isolated test Postgres, runs backend API tests on host Go toolchain, then tears test DB down.
# Use: ./run-tests.sh (set KEEP_TEST_DB=true to keep DB running)
# DB: devbits_test (from backend/.env.test or defaults) in compose project devbits-test-local.
# Ports: test DB mapped to :5432 by docker-compose.test.yml.
# Modes: Frontend=OFF | Backend=tests only (no live deployment changes) | Live stack untouched | Test DB only.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT/backend"
COMPOSE_PROJECT="devbits-test-local"

KEEP_DB=${KEEP_TEST_DB:-false}

echo "=== DevBits Test Suite ==="

if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if [ -f .env.test ]; then
    echo "Loading environment from .env.test..."
    set -a
    source .env.test
    set +a
else
    echo "Warning: .env.test not found. Using default test environment values."
    export POSTGRES_TEST_DB=devbits_test
    export POSTGRES_TEST_USER=testuser
    export POSTGRES_TEST_PASSWORD=testpass123
fi

echo "Starting test database..."
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.test.yml down -v
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.test.yml up -d

echo "Waiting for database to be ready..."
sleep 5

MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker compose -p "$COMPOSE_PROJECT" -f docker-compose.test.yml exec -T test-db pg_isready -U testuser -d devbits_test > /dev/null 2>&1; then
        echo "Database is ready!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for database... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "Error: Database failed to start within timeout"
    exit 1
fi

export USE_TEST_DB=true

echo ""
echo "Running tests..."
echo ""

go test -v ./api/internal/tests/...

TEST_RESULT=$?

echo ""
if [ $TEST_RESULT -eq 0 ]; then
    echo "All tests passed!"
else
    echo "Tests failed!"
fi

if [ "$KEEP_DB" != "true" ]; then
    echo ""
    echo "Stopping test database..."
    docker compose -p "$COMPOSE_PROJECT" -f docker-compose.test.yml down -v
else
    echo ""
    echo "Test database is still running."
    echo "Run 'docker compose -p $COMPOSE_PROJECT -f docker-compose.test.yml down' to stop it."
fi

exit $TEST_RESULT
