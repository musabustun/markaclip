#!/usr/bin/env bash
# Rasterises assets/logo/markaclip-mark.svg into the extension icon sizes
# using headless Google Chrome (no extra tooling needed on macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SVG="$ROOT/assets/logo/markaclip-mark.svg"
OUT="$ROOT/assets/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"

for size in 16 32 48 128; do
  cat > "$TMP/icon.html" <<EOF
<html><body style="margin:0;background:transparent">
<img src="file://$SVG" width="$size" height="$size" style="display:block">
</body></html>
EOF
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files \
    --default-background-color=00000000 \
    --window-size="$size,$size" \
    --screenshot="$OUT/icon-$size.png" \
    "file://$TMP/icon.html" >/dev/null 2>&1
  echo "✓ icon-$size.png"
done
