#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[precheck] typecheck"
pnpm -r typecheck

echo "[precheck] tests"
pnpm test

echo "[precheck] i18n catalog"
pnpm --filter @blodex/game-client i18n:check

echo "[precheck] css architecture"
pnpm --filter @blodex/game-client css:check

echo "[precheck] content locale consistency"
pnpm check:content-i18n

echo "[precheck] source hygiene"
./scripts/check-source-hygiene.sh

echo "[precheck] all gates passed."
