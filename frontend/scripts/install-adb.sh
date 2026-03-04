#!/usr/bin/env bash
set -euo pipefail

# Install ADB (Android platform-tools) on Linux systems.
# Tries common package managers first, falls back to downloading official platform-tools.
# Usage: sudo ./scripts/install-adb.sh

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root (sudo)."
  exit 1
fi

if command -v adb >/dev/null 2>&1; then
  echo "adb is already installed: $(adb version 2>/dev/null || true)"
  exit 0
fi

echo "Attempting to install adb via package manager..."

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  # try several common package names
  if apt-get install -y android-tools-adb 2>/dev/null; then
    echo "Installed android-tools-adb via apt." && adb version && exit 0
  fi
  if apt-get install -y android-sdk-platform-tools 2>/dev/null; then
    echo "Installed android-sdk-platform-tools via apt." && adb version && exit 0
  fi
  if apt-get install -y adb 2>/dev/null; then
    echo "Installed adb via apt." && adb version && exit 0
  fi
fi

if command -v dnf >/dev/null 2>&1; then
  if dnf install -y android-tools 2>/dev/null; then
    echo "Installed android-tools via dnf." && adb version && exit 0
  fi
fi

if command -v yum >/dev/null 2>&1; then
  if yum install -y android-tools 2>/dev/null; then
    echo "Installed android-tools via yum." && adb version && exit 0
  fi
fi

if command -v pacman >/dev/null 2>&1; then
  if pacman -Sy --noconfirm android-tools 2>/dev/null; then
    echo "Installed android-tools via pacman." && adb version && exit 0
  fi
fi

if command -v apk >/dev/null 2>&1; then
  if apk add --no-cache android-tools 2>/dev/null; then
    echo "Installed android-tools via apk." && adb version && exit 0
  fi
fi

echo "Package manager install failed or not available — downloading official platform-tools..."

TMPDIR=$(mktemp -d)
PLATFORM_URL="https://dl.google.com/android/repository/platform-tools-latest-linux.zip"
ZIPFILE="$TMPDIR/platform-tools.zip"
INSTALL_DIR="/opt/platform-tools"

echo "Downloading platform-tools from $PLATFORM_URL..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$PLATFORM_URL" -o "$ZIPFILE"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$ZIPFILE" "$PLATFORM_URL"
else
  echo "Error: curl or wget required to download platform-tools." >&2
  exit 1
fi

echo "Extracting to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$ZIPFILE" -d "$TMPDIR"
else
  # try bsdtar or tar with zip support
  if command -v bsdtar >/dev/null 2>&1; then
    bsdtar -xf "$ZIPFILE" -C "$TMPDIR"
  else
    echo "unzip or bsdtar required to extract the archive." >&2
    exit 1
  fi
fi

if [ -d "$TMPDIR/platform-tools" ]; then
  rm -rf "$INSTALL_DIR" || true
  mv "$TMPDIR/platform-tools" "$INSTALL_DIR"
else
  echo "Unexpected archive structure, cannot find platform-tools directory." >&2
  exit 1
fi

ln -sf "$INSTALL_DIR/adb" /usr/local/bin/adb
ln -sf "$INSTALL_DIR/fastboot" /usr/local/bin/fastboot || true

chmod +x "$INSTALL_DIR/adb" || true

echo "Cleaning up..."
rm -rf "$TMPDIR"

echo "Installed platform-tools to $INSTALL_DIR"
echo "adb version: $(/usr/local/bin/adb version 2>/dev/null || true)"

echo "Add $INSTALL_DIR to PATH for non-root users, for example add this line to ~/.profile or /etc/profile.d/android.sh:"
echo "  export PATH=\"$INSTALL_DIR:\$PATH\""

echo "Done."
