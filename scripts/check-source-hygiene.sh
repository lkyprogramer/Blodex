#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

violations="$(
  find apps packages -type f -path '*/src/*' \
    \( -name '*.js' -o -name '*.js.map' -o -name '*.d.ts' -o -name '*.d.ts.map' \) \
    | sort
)"

if [[ -n "$violations" ]]; then
  echo "[hygiene] Illegal build artifacts detected under src/:"
  while IFS= read -r filePath; do
    [[ -z "$filePath" ]] && continue
    echo " - $filePath"
  done <<< "$violations"
  exit 1
fi

echo "[hygiene] source tree is clean."
