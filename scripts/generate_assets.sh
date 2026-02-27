#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROVIDER="${IMAGE_PROVIDER:-gemini}"
MODEL="${IMAGE_MODEL:-gemini-3.1-flash-image-preview}"

mkdir -p "$ROOT_DIR/output/imagegen/raw"

if [[ "$PROVIDER" == "gemini" ]]; then
  python3 "$ROOT_DIR/scripts/generate_assets_gemini.py" \
    --input "$ROOT_DIR/tmp/imagegen/jobs.jsonl" \
    --out-dir "$ROOT_DIR/output/imagegen/raw" \
    --model "$MODEL"
else
  CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"
  if [[ ! -f "$IMAGE_GEN" ]]; then
    echo "Missing image_gen.py at $IMAGE_GEN" >&2
    exit 1
  fi

  uv run --with openai --with pillow python3 "$IMAGE_GEN" generate-batch \
    --input "$ROOT_DIR/tmp/imagegen/jobs.jsonl" \
    --out-dir "$ROOT_DIR/output/imagegen/raw" \
    --concurrency 4 \
    --force
fi

echo "Raw image generation completed at output/imagegen/raw"
