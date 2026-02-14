#!/bin/bash

# Exit immediately if a command exits with a non-zero status
# (Equivalent to $ErrorActionPreference = "Stop")
set -e

# Get the directory where the script is located
# (Equivalent to Split-Path -Parent $MyInvocation.MyCommand.Path)
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Start the Backend
# We use 'cd' inside a subshell () to keep the paths clean
echo "Starting backend..."
(
  cd "$ROOT/backend"
  export DEVBITS_DEBUG=1
  go run ./api
) &

# Start the Frontend
echo "Starting frontend..."
(
  cd "$ROOT/frontend"
  npm run frontend
) &

# Keep the script alive so the background processes don't orphan immediately
# or wait for them to finish
wait
