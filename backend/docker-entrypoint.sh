#!/bin/sh
set -e

if [ -z "$DEVBITS_JWT_SECRET" ] && [ "$DEVBITS_FORCE_RANDOM_JWT_SECRET" = "1" ]; then
  if command -v openssl >/dev/null 2>&1; then
    export DEVBITS_JWT_SECRET="$(openssl rand -hex 32)"
  else
    export DEVBITS_JWT_SECRET=$(head -c 32 /dev/urandom | od -An -v -tx1 | tr -d ' \n')
  fi
  echo "Generated DEVBITS_JWT_SECRET"
else
  if [ -z "$DEVBITS_JWT_SECRET" ]; then
    echo "DEVBITS_JWT_SECRET not set; using backend default secret for development"
  fi
fi

exec "$@"
