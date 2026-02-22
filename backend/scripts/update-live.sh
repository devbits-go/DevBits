#!/bin/bash

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  sudo "$0" "$@"
  exit
fi

set -e

echo "Updating the live application by rebuilding and restarting the backend service..."

# Get the directory of the script
script_dir=$(dirname "$(readlink -f "$0")")
root_dir=$(realpath "$script_dir/..")

# Change to the root directory of the backend
cd "$root_dir"

env_file="$root_dir/.env"
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Create it from backend/.env.example and set strong credentials before deploying." >&2
  exit 1
fi

postgres_password="$(grep -E '^POSTGRES_PASSWORD=' "$env_file" | tail -n 1 | cut -d '=' -f2- || true)"
if [[ -z "$postgres_password" ]]; then
  echo "POSTGRES_PASSWORD is not set in $env_file" >&2
  exit 1
fi
if [[ "$postgres_password" == "password" || "$postgres_password" == "changeme" || "$postgres_password" == "devbits" ]]; then
  echo "POSTGRES_PASSWORD in $env_file is weak/default. Set a strong random value before deploying." >&2
  exit 1
fi

docker compose up -d --build backend nginx

echo "Backend and nginx services have been updated."

live_backend_state="unavailable"
if backend_status_output="$(docker compose ps backend 2>/dev/null)"; then
  if echo "$backend_status_output" | grep -q "Up"; then
    live_backend_state="running"
  else
    live_backend_state="not running"
  fi
fi

echo
echo "===== Summary ====="
echo "Action: Live backend update executed"
echo "Updated: Backend rebuilt; nginx refreshed"
echo "Live backend: $live_backend_state"
