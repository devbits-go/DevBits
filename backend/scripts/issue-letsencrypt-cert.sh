#!/usr/bin/env bash
set -euo pipefail

# Issues or renews a Let's Encrypt certificate for the public domain used by nginx.
# This script stops nginx briefly so certbot can bind to :80 for HTTP-01 validation.

DOMAIN="devbits.ddns.net"
EMAIL=""
STAGING="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --staging)
      STAGING="1"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --email you@example.com [--domain devbits.ddns.net] [--staging]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$EMAIL" ]]; then
  echo "Missing required --email argument." >&2
  echo "Usage: $0 --email you@example.com [--domain devbits.ddns.net] [--staging]" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 is required but was not found." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="$BACKEND_DIR/nginx/certs/live/$DOMAIN"

CERTBOT_FLAGS=(
  certonly
  --standalone
  --preferred-challenges http
  --agree-tos
  --non-interactive
  --keep-until-expiring
  --email "$EMAIL"
  -d "$DOMAIN"
)

if [[ "$STAGING" == "1" ]]; then
  CERTBOT_FLAGS+=(--staging)
fi

echo "Issuing/renewing Let's Encrypt certificate for $DOMAIN ..."
cd "$BACKEND_DIR"

# Free port 80 so certbot standalone can complete HTTP-01 validation.
docker compose stop nginx >/dev/null 2>&1 || true

docker run --rm \
  -p 80:80 \
  -v "$BACKEND_DIR/nginx/certs:/etc/letsencrypt" \
  -v "$BACKEND_DIR/nginx/certs/lib:/var/lib/letsencrypt" \
  certbot/certbot "${CERTBOT_FLAGS[@]}"

# Bring nginx back online.
docker compose up -d nginx >/dev/null

missing=0
for file in fullchain.pem privkey.pem chain.pem; do
  path="$CERT_DIR/$file"
  if [[ ! -s "$path" ]]; then
    echo "Missing or empty: $path" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Certificate issuance completed with missing files. Check certbot output above." >&2
  exit 1
fi

echo "Certificate files verified:"
ls -l "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" "$CERT_DIR/chain.pem"
echo "Done."
