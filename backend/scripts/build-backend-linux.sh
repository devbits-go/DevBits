#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

mkdir -p bin uploads

TARGET_GOOS="${TARGET_GOOS:-linux}"
if [[ -n "${TARGET_GOARCH:-}" ]]; then
	TARGET_GOARCH="${TARGET_GOARCH}"
else
	case "$(uname -m)" in
		x86_64) TARGET_GOARCH="amd64" ;;
		aarch64|arm64) TARGET_GOARCH="arm64" ;;
		*) TARGET_GOARCH="amd64" ;;
	esac
fi
OUTPUT_PATH="${OUTPUT_PATH:-$ROOT_DIR/bin/devbits-api}"

echo "Building DevBits backend for ${TARGET_GOOS}/${TARGET_GOARCH}..."
CGO_ENABLED=0 GOOS="$TARGET_GOOS" GOARCH="$TARGET_GOARCH" go build -trimpath -ldflags="-s -w" -o "$OUTPUT_PATH" ./api

echo "Build complete: $OUTPUT_PATH"
