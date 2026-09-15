#!/usr/bin/env bash
# Regenerate cv/Constantine_Gurnov_CV.pdf from tools/cv-print.html.
# Edit the HTML, run this, commit both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME"; exit 1; }

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$ROOT/cv/Constantine_Gurnov_CV.pdf" \
  "file://$ROOT/tools/cv-print.html" >/dev/null 2>&1

echo "Wrote $ROOT/cv/Constantine_Gurnov_CV.pdf"
