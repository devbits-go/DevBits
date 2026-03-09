#!/usr/bin/env bash

# Script: run-front.sh
# Does: Starts Expo frontend and lets you choose backend target (Local or Live).
# Use: ./run-front.sh [--local|--live|--production] [--clear] [--dev-client]
# DB: None (frontend only).
# Ports: Metro uses LAN IP; local API defaults to :8080 (EXPO_PUBLIC_LOCAL_API_PORT overrides).
# Modes: Frontend=ON | Backend=Production URL or Local URL | Live stack untouched | Dev/Test DB untouched.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend"

MODE=""
CLEAR_FLAG=""
DEV_CLIENT=false

for arg in "$@"; do
  case "$arg" in
    --clear)
      CLEAR_FLAG="--clear"
      ;;
    --dev-client)
      DEV_CLIENT=true
      ;;
    --local)
      MODE="local"
      ;;
    --production)
      MODE="production"
      ;;
    --live)
      MODE="production"
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: ./run-front.sh [--local|--live|--production] [--clear] [--dev-client]"
      exit 1
      ;;
  esac
done

detect_lan_ip() {
  local from_route=""
  local iface=""

  if command -v ip >/dev/null 2>&1; then
    from_route="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
    if [[ "$from_route" =~ ^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
      echo "$from_route"
      return 0
    fi

    iface="$(ip route 2>/dev/null | awk '/^default/ {print $5; exit}')"
    if [[ -n "$iface" ]]; then
      ip -4 addr show dev "$iface" scope global 2>/dev/null |
        awk '/inet / {print $2}' |
        cut -d/ -f1 |
        grep -E '^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.' |
        head -n1
      return 0
    fi
  fi

  hostname -I 2>/dev/null |
    tr ' ' '\n' |
    grep -E '^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.' |
    head -n1
}

LAN_IP="$(detect_lan_ip || true)"
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="127.0.0.1"
  echo "Warning: Could not detect private LAN IPv4."
fi

if [[ -z "$MODE" ]]; then
  echo "Select backend: 1) Live (devbits.app) 2) Local (LAN IP:8080)"
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

if [[ "$LAN_IP" != "127.0.0.1" ]]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
  export EXPO_PACKAGER_HOSTNAME="$LAN_IP"
else
  unset REACT_NATIVE_PACKAGER_HOSTNAME || true
  unset EXPO_PACKAGER_HOSTNAME || true
fi
export EXPO_PUBLIC_API_URL="https://devbits.app"
export EXPO_PUBLIC_API_FALLBACK_URL="https://devbits.app"

if [[ "$MODE" == "local" ]]; then
  LOCAL_API_PORT="${EXPO_PUBLIC_LOCAL_API_PORT:-8080}"

  if [[ "$LAN_IP" == "127.0.0.1" && "${DEVBITS_ALLOW_LOOPBACK_LOCAL_API:-0}" != "1" ]]; then
    echo "Error: Local mode resolved loopback (127.0.0.1), which will fail on physical devices."
    echo "Fix one of the following and try again:"
    echo "  1) Run without sudo so network detection can read your user network context."
    echo "  2) Set EXPO_PUBLIC_LOCAL_API_URL manually, e.g. http://192.168.x.y:${LOCAL_API_PORT}."
    echo "  3) If using only simulator/emulator intentionally, set DEVBITS_ALLOW_LOOPBACK_LOCAL_API=1."
    exit 1
  fi

  export EXPO_PUBLIC_USE_LOCAL_API=1
  if [[ -z "${EXPO_PUBLIC_LOCAL_API_URL:-}" ]]; then
    export EXPO_PUBLIC_LOCAL_API_URL="http://${LAN_IP}:${LOCAL_API_PORT}"
  fi
  echo "Using local backend: $EXPO_PUBLIC_LOCAL_API_URL"
else
  export EXPO_PUBLIC_USE_LOCAL_API=0
  unset EXPO_PUBLIC_LOCAL_API_URL || true
  echo "Using live backend: https://devbits.app"
fi

cd "$FRONTEND_DIR"

EXPO_ARGS=(expo start --host lan)
if [[ "$DEV_CLIENT" == "true" ]]; then
  EXPO_ARGS+=(--dev-client)
else
  EXPO_ARGS+=(--go)
fi

if [[ -n "$CLEAR_FLAG" ]]; then
  EXPO_ARGS+=(--clear)
fi

exec npx "${EXPO_ARGS[@]}"
