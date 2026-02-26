#!/bin/bash

# Start frontend against hosted API
set -e

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [[ -z "${API_URL:-}" ]]; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z "$LAN_IP" ]]; then
    LAN_IP="localhost"
  fi
  API_URL="http://$LAN_IP"
fi

echo "Starting frontend against API: $API_URL"
(
  cd "$ROOT/frontend"
  EXPO_PUBLIC_USE_LOCAL_API="1" EXPO_PUBLIC_API_URL="$API_URL" EXPO_PUBLIC_API_FALLBACK_URL="$API_URL" npm run frontend
) &

wait

echo
echo "===== Summary ====="
echo "Action: Started frontend"
echo "Frontend API URL: $API_URL"
