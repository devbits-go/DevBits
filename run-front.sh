#!/usr/bin/env bash

# Script: run-front.sh
# Does: Starts Expo frontend and lets you choose backend target (Production or Local).
# Use: ./run-front.sh [--local|--production] [--clear]
# DB: None (frontend only).
# Ports: Metro uses LAN IP; local API defaults to :8080 (EXPO_PUBLIC_LOCAL_API_PORT overrides).
# Modes: Frontend=ON | Backend=Production URL or Local URL | Live stack untouched | Dev/Test DB untouched.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT/frontend"

MODE=""
CLEAR_FLAG=""

for arg in "$@"; do
  case "$arg" in
    --clear)
      CLEAR_FLAG="--clear"
      ;;
    --local)
      MODE="local"
      ;;
    --production)
      MODE="production"
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: ./run-front.sh [--local|--production] [--clear]"
      exit 1
      ;;
  esac
done

detect_lan_ip() {
  hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.' | head -n1
}

LAN_IP="$(detect_lan_ip || true)"
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="127.0.0.1"
  echo "Warning: Could not detect private LAN IPv4. Falling back to 127.0.0.1."
fi

if [[ -z "$MODE" ]]; then
  echo "Select backend: 1) Production (devbits.ddns.net) 2) Local (LAN IP:8080)"
  read -r -p "Choose [1/2]: " selection
  case "$selection" in
    1) MODE="production" ;;
    2) MODE="local" ;;
    *)
      echo "Invalid selection."
      exit 1
      ;;
  esac
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_PUBLIC_API_URL="https://devbits.ddns.net"
export EXPO_PUBLIC_API_FALLBACK_URL="https://devbits.ddns.net"

if [[ "$MODE" == "local" ]]; then
  LOCAL_API_PORT="${EXPO_PUBLIC_LOCAL_API_PORT:-8080}"
  export EXPO_PUBLIC_USE_LOCAL_API=1
  export EXPO_PUBLIC_LOCAL_API_URL="http://${LAN_IP}:${LOCAL_API_PORT}"
  echo "Using local backend: $EXPO_PUBLIC_LOCAL_API_URL"
else
  export EXPO_PUBLIC_USE_LOCAL_API=0
  unset EXPO_PUBLIC_LOCAL_API_URL || true
  echo "Using production backend: https://devbits.ddns.net"
fi

cd "$FRONTEND_DIR"

if [[ -n "$CLEAR_FLAG" ]]; then
  exec npx expo start --dev-client --clear
else
  exec npx expo start --dev-client
fi
