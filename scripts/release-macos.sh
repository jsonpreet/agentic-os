#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building shared contracts and engine..."
pnpm --filter @agentic/shared-contracts build
pnpm --filter @agentic/local-engine build

echo "Building desktop (Tauri) release..."
pnpm --filter @agentic/desktop tauri build

echo "Release artifacts are in packages/desktop/src-tauri/target/release/bundle/"
echo "Next: codesign + notarize the .app and .dmg with your Apple Developer credentials."
