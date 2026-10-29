#!/usr/bin/env bash
# Builds dist/markaclip-v<version>.zip with only the files Chrome needs.
# manifest.json sits at the zip root, so the same file works for
# "Load unpacked" (after extracting) and for Chrome Web Store uploads.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/manifest.json').version")"
OUT="$ROOT/dist/markaclip-v$VERSION.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R "$ROOT/manifest.json" "$ROOT/src" "$ROOT/assets" "$STAGE/"
find "$STAGE" -name '.DS_Store' -delete

mkdir -p "$ROOT/dist"
rm -f "$OUT"
(cd "$STAGE" && zip -rqX "$OUT" .)

echo "✓ $OUT ($(du -h "$OUT" | cut -f1))"
