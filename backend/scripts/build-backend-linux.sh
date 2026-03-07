#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

mkdir -p bin uploads

TARGET_GOOS="${TARGET_GOOS:-linux}"
TARGET_GOARCH="${TARGET_GOARCH:-amd64}"
OUTPUT_PATH="${OUTPUT_PATH:-$ROOT_DIR/bin/devbits-api}"

echo "Building DevBits backend for ${TARGET_GOOS}/${TARGET_GOARCH}..."
CGO_ENABLED=0 GOOS="$TARGET_GOOS" GOARCH="$TARGET_GOARCH" go build -trimpath -ldflags="-s -w" -o "$OUTPUT_PATH" ./api

echo "Build complete: $OUTPUT_PATH"
