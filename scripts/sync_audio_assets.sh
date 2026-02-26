#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/assets/generated/audio-manifest.json"
SOURCE_DIR="$ROOT_DIR/assets/audio-sources"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing audio manifest: $MANIFEST" >&2
  exit 1
fi

mkdir -p "$SOURCE_DIR"
mkdir -p "$ROOT_DIR/apps/game-client/public/audio"

node -e '
const fs = require("node:fs");
const path = require("node:path");
const manifestPath = process.argv[1];
const entries = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const e of entries) {
  process.stdout.write(`${e.id}\t${e.sourceRef}\t${e.outputPath}\n`);
}
' "$MANIFEST" | while IFS=$'\t' read -r id source_ref output_path; do
  src="$SOURCE_DIR/$source_ref"
  dst="$ROOT_DIR/$output_path"

  mkdir -p "$(dirname "$dst")"

  if [[ ! -f "$src" ]]; then
    echo "[sync_audio_assets] source missing for $id: $src, generating silence placeholder"
    if command -v ffmpeg >/dev/null 2>&1; then
      ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 0.5 -q:a 8 -y "$src" >/dev/null 2>&1
    else
      : > "$src"
    fi
  fi

  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -i "$src" -ac 1 -ar 48000 -af loudnorm=I=-16:TP=-1.5:LRA=11 -y "$dst" >/dev/null 2>&1
  else
    cp "$src" "$dst"
  fi

  echo "[sync_audio_assets] $id -> $output_path"
done

echo "Audio assets synced to apps/game-client/public/audio"
