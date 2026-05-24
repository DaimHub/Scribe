#!/usr/bin/env bash
# Mounts the freshly built DMG and copies Scribe.app to /Applications.
# Replaces any prior install. Quits a running Scribe first so the copy succeeds.
set -euo pipefail

cd "$(dirname "$0")/.."

DMG=$(ls -t release/Scribe-*-arm64.dmg 2>/dev/null | head -n1 || true)
if [ -z "$DMG" ]; then
  echo "ERROR: no DMG found in release/. Did electron-builder fail?" >&2
  exit 1
fi

echo "install: using $DMG"

# Quit any running Scribe so we can overwrite the bundle.
osascript -e 'tell application "Scribe" to quit' >/dev/null 2>&1 || true
sleep 1

MOUNT_OUT=$(hdiutil attach -nobrowse -noverify -noautoopen "$DMG")
MOUNT_POINT=$(echo "$MOUNT_OUT" | awk -F'\t' 'END {print $NF}' | sed 's/^ *//')

cleanup() {
  if [ -n "${MOUNT_POINT:-}" ] && [ -d "$MOUNT_POINT" ]; then
    hdiutil detach "$MOUNT_POINT" -quiet || true
  fi
}
trap cleanup EXIT

if [ -d "/Applications/Scribe.app" ]; then
  rm -rf "/Applications/Scribe.app"
fi

ditto "$MOUNT_POINT/Scribe.app" "/Applications/Scribe.app"

# Locally built and unsigned: strip the quarantine bit so Gatekeeper doesn't
# block first launch. Safe because we just built this on this machine.
xattr -dr com.apple.quarantine "/Applications/Scribe.app" 2>/dev/null || true

echo "install: Scribe.app is now in /Applications."
