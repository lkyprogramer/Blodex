#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_MAX_CLASS_FILE_LINES=900
DEFAULT_MAX_CLASS_METHODS=60

resolve_debt_ceiling_lines() {
  case "$1" in
    "apps/game-client/src/scenes/DungeonScene.ts")
      echo 4286
      ;;
    "apps/game-client/src/ui/hud/HudContainer.ts")
      echo 1186
      ;;
    *)
      echo ""
      ;;
  esac
}

resolve_debt_ceiling_methods() {
  case "$1" in
    "apps/game-client/src/scenes/DungeonScene.ts")
      echo 92
      ;;
    *)
      echo ""
      ;;
  esac
}

resolve_max_lines() {
  case "$1" in
    "apps/game-client/src/scenes/DungeonScene.ts")
      echo 2600
      ;;
    "apps/game-client/src/scenes/MetaMenuScene.ts")
      echo 1200
      ;;
    "apps/game-client/src/ui/Hud.ts")
      echo 300
      ;;
    "apps/game-client/src/ui/hud/HudContainer.ts")
      echo 1100
      ;;
    *)
      echo "$DEFAULT_MAX_CLASS_FILE_LINES"
      ;;
  esac
}

resolve_max_methods() {
  case "$1" in
    "apps/game-client/src/scenes/DungeonScene.ts")
      echo 90
      ;;
    "apps/game-client/src/scenes/MetaMenuScene.ts")
      echo 85
      ;;
    "apps/game-client/src/ui/Hud.ts")
      echo 25
      ;;
    "apps/game-client/src/ui/hud/HudContainer.ts")
      echo 60
      ;;
    *)
      echo "$DEFAULT_MAX_CLASS_METHODS"
      ;;
  esac
}

is_allowlisted_file() {
  case "$1" in
      "apps/game-client/src/scenes/DungeonScene.ts" | \
      "apps/game-client/src/scenes/MetaMenuScene.ts" | \
      "apps/game-client/src/ui/Hud.ts" | \
      "apps/game-client/src/ui/hud/HudContainer.ts")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

violations=()
budgetDebt=()
budgetWarnings=()

while IFS= read -r filePath; do
  [[ -z "$filePath" ]] && continue
  if ! rg -q 'class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' "$filePath"; then
    continue
  fi

  lineCount="$(wc -l < "$filePath" | tr -d ' ')"
  methodCount="$(
    {
      rg -n '^[[:space:]]+(private|protected|public)[[:space:]]+(readonly[[:space:]]+)?(async[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\(' "$filePath" || true
      rg -n '^[[:space:]]+constructor[[:space:]]*\(' "$filePath" || true
    } | wc -l | tr -d ' '
  )"

  maxLines="$(resolve_max_lines "$filePath")"
  maxMethods="$(resolve_max_methods "$filePath")"
  debtCeilingLines="$(resolve_debt_ceiling_lines "$filePath")"
  debtCeilingMethods="$(resolve_debt_ceiling_methods "$filePath")"

  if (( lineCount > maxLines )); then
    if [[ -n "$debtCeilingLines" ]] && (( lineCount <= debtCeilingLines )); then
      budgetWarnings+=("[lines] $filePath remains above target ($lineCount > $maxLines), temporary debt ceiling $debtCeilingLines")
    else
      violations+=("[lines] $filePath ($lineCount > $maxLines)")
    fi
  fi
  if (( methodCount > maxMethods )); then
    if [[ -n "$debtCeilingMethods" ]] && (( methodCount <= debtCeilingMethods )); then
      budgetWarnings+=("[methods] $filePath remains above target ($methodCount > $maxMethods), temporary debt ceiling $debtCeilingMethods")
    else
      violations+=("[methods] $filePath ($methodCount > $maxMethods)")
    fi
  fi

  if is_allowlisted_file "$filePath"; then
    entry="$filePath lines=$lineCount/$maxLines methods=$methodCount/$maxMethods"
    if [[ -n "$debtCeilingLines" ]]; then
      entry="$entry debt-lines=$debtCeilingLines"
    fi
    if [[ -n "$debtCeilingMethods" ]]; then
      entry="$entry debt-methods=$debtCeilingMethods"
    fi
    budgetDebt+=("$entry")
  fi
done < <(
  rg --files apps packages \
    | rg '/src/.*\.(ts|tsx)$' \
    | rg -v '(__tests__/|\.test\.|\.spec\.)' \
    | sort
)

if (( ${#budgetDebt[@]} > 0 )); then
  echo "[architecture-budget] temporary debt allowlist:"
  for entry in "${budgetDebt[@]}"; do
    echo " - $entry"
  done
fi

if (( ${#budgetWarnings[@]} > 0 )); then
  echo "[architecture-budget] debt warnings:"
  for warning in "${budgetWarnings[@]}"; do
    echo " - $warning"
  done
fi

if (( ${#violations[@]} > 0 )); then
  echo "[architecture-budget] violations detected:"
  for violation in "${violations[@]}"; do
    echo " - $violation"
  done
  echo "[architecture-budget] fail: split classes/files or tighten budgets per file by exception."
  exit 1
fi

echo "[architecture-budget] checks passed."
