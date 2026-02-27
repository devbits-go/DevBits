#!/bin/sh
set -e

# By default do NOT generate a random DEVBITS_JWT_SECRET here. Generating a
# new random secret at container start causes tokens signed by the backend to
# change on each restart which breaks client sessions during local development.
#
# If you explicitly want a random secret (production automation), set
# DEVBITS_FORCE_RANDOM_JWT_SECRET=1 and a 32-byte hex secret will be generated.
if [ -z "$DEVBITS_JWT_SECRET" ] && [ "$DEVBITS_FORCE_RANDOM_JWT_SECRET" = "1" ]; then
  if command -v openssl >/dev/null 2>&1; then
    export DEVBITS_JWT_SECRET="$(openssl rand -hex 32)"
  else
    # Fallback using /dev/urandom and od
    export DEVBITS_JWT_SECRET=$(head -c 32 /dev/urandom | od -An -v -tx1 | tr -d ' \n')
  fi
  echo "Generated DEVBITS_JWT_SECRET"
else
  if [ -z "$DEVBITS_JWT_SECRET" ]; then
    echo "DEVBITS_JWT_SECRET not set; using backend default secret for development"
  fi
fi

# Execute the container command
exec "$@"
