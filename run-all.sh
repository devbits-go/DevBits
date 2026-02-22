#!/bin/bash

# Start frontend against hosted API
set -e

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
API_URL="${API_URL:-https://devbits.ddns.net}"

echo "Starting frontend against API: $API_URL"
(
  cd "$ROOT/frontend"
  EXPO_PUBLIC_API_URL="$API_URL" EXPO_PUBLIC_API_FALLBACK_URL="$API_URL" npm run frontend
) &

wait

echo
echo "===== Summary ====="
echo "Action: Started frontend"
echo "Frontend API URL: $API_URL"
