#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building web viewer bundle..."
pnpm --filter @agentic/shared-contracts build
pnpm --filter @agentic/desktop build:viewer

OUTPUT_DIR="packages/desktop/dist-viewer"
ARCHIVE="packages/desktop/dist-viewer.zip"

if command -v zip >/dev/null 2>&1; then
  rm -f "$ARCHIVE"
  (cd "$OUTPUT_DIR" && zip -r "../dist-viewer.zip" .)
  echo "Created $ARCHIVE"
fi

cat <<EOF

Windows viewer package is ready in:
  $OUTPUT_DIR

Serve it with any static file server, then open:
  http://localhost:8080/viewer?relay=ws://<host>:3848&deviceId=<device-id>

Example:
  cd $OUTPUT_DIR
  npx --yes serve -l 8080 .

Host setup:
  1. pnpm relay:dev
  2. AGENTIC_RELAY_URL=ws://localhost:3848 pnpm dev
  3. Copy device id from Settings → Cloud

EOF
