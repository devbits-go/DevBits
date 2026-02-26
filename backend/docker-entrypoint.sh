#!/bin/sh
set -e

# Ensure a DEVBITS_JWT_SECRET exists. If not set, generate a 32-byte hex secret.
if [ -z "$DEVBITS_JWT_SECRET" ]; then
  if command -v openssl >/dev/null 2>&1; then
    export DEVBITS_JWT_SECRET="$(openssl rand -hex 32)"
  else
    # Fallback using /dev/urandom and od
    export DEVBITS_JWT_SECRET=$(head -c 32 /dev/urandom | od -An -v -tx1 | tr -d ' \n')
  fi
  echo "Generated DEVBITS_JWT_SECRET"
fi

# Execute the container command
exec "$@"
