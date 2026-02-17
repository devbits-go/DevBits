#!/bin/bash

# Exit immediately if a command exits with a non-zero status
# (Equivalent to $ErrorActionPreference = "Stop")
set -e

# Get the directory where the script is located
# (Equivalent to Split-Path -Parent $MyInvocation.MyCommand.Path)
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

is_port_listening() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltn | grep -q ":${port}[[:space:]]"
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  netstat -ltn 2>/dev/null | grep -q ":${port}[[:space:]]"
}

# Start the Backend
# We use 'cd' inside a subshell () to keep the paths clean
if is_port_listening 8080; then
  echo "Backend already running on port 8080; skipping duplicate start."
else
  echo "Starting backend..."
  (
    cd "$ROOT/backend"
    export DEVBITS_DEBUG=1
    go run ./api
  ) &
fi

# Start the Frontend
echo "Starting frontend..."
(
  cd "$ROOT/frontend"
  npm run frontend
) &

# Keep the script running until all background processes finish
wait
