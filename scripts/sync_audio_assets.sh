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

float_gt() {
  local left="$1"
  local right="$2"
  awk -v l="$left" -v r="$right" 'BEGIN { exit !(l > r) }'
}

float_lt() {
  local left="$1"
  local right="$2"
  awk -v l="$left" -v r="$right" 'BEGIN { exit !(l < r) }'
}

probe_duration() {
  local file="$1"
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$file" 2>/dev/null || echo "0"
}

probe_peak_abs() {
  local file="$1"
  ffmpeg -nostdin -v error -i "$file" -t 0.2 -f f32le -acodec pcm_f32le - 2>/dev/null \
    | od -An -t f4 \
    | awk '{for(i=1;i<=NF;i++){v=$i+0;if(v<0)v=-v;if(v>m)m=v}} END{if(m=="")m=0; printf "%.4f", m}'
}

fade_start_for() {
  local duration="$1"
  awk -v d="$duration" 'BEGIN { s=d-0.09; if (s<0) s=0; printf "%.3f", s }'
}

render_tone() {
  local out="$1"
  local freq="$2"
  local duration="$3"
  local gain="$4"
  local fade_start
  fade_start="$(fade_start_for "$duration")"
  ffmpeg -nostdin -v error -f lavfi -i "sine=frequency=${freq}:sample_rate=48000:duration=${duration}" \
    -af "highpass=f=70,lowpass=f=6400,volume=${gain},afade=t=in:st=0:d=0.01,afade=t=out:st=${fade_start}:d=0.08,alimiter=limit=0.88" \
    -ac 1 -ar 48000 -c:a libvorbis -q:a 5 -y "$out"
}

render_dual_tone() {
  local out="$1"
  local freq_a="$2"
  local freq_b="$3"
  local duration="$4"
  local gain_a="$5"
  local gain_b="$6"
  local fade_start
  fade_start="$(fade_start_for "$duration")"
  ffmpeg -nostdin -v error \
    -f lavfi -i "sine=frequency=${freq_a}:sample_rate=48000:duration=${duration}" \
    -f lavfi -i "sine=frequency=${freq_b}:sample_rate=48000:duration=${duration}" \
    -filter_complex "[0:a]volume=${gain_a}[a0];[1:a]volume=${gain_b}[a1];[a0][a1]amix=inputs=2,highpass=f=80,lowpass=f=7000,afade=t=in:st=0:d=0.01,afade=t=out:st=${fade_start}:d=0.08,alimiter=limit=0.88" \
    -ac 1 -ar 48000 -c:a libvorbis -q:a 5 -y "$out"
}

render_ambient() {
  local out="$1"
  local base_freq="$2"
  local duration="$3"
  local fade_start
  fade_start="$(awk -v d="$duration" 'BEGIN { s=d-0.8; if (s<0) s=0; printf "%.3f", s }')"
  ffmpeg -nostdin -v error \
    -f lavfi -i "anoisesrc=color=pink:sample_rate=48000:duration=${duration}:amplitude=0.35" \
    -f lavfi -i "sine=frequency=${base_freq}:sample_rate=48000:duration=${duration}" \
    -filter_complex "[0:a]lowpass=f=1400,highpass=f=60,volume=0.14[n];[1:a]lowpass=f=320,volume=0.10[d];[n][d]amix=inputs=2,afade=t=in:st=0:d=0.5,afade=t=out:st=${fade_start}:d=0.7,alimiter=limit=0.82" \
    -ac 1 -ar 48000 -c:a libvorbis -q:a 5 -y "$out"
}

generate_procedural_source() {
  local id="$1"
  local src="$2"

  case "$id" in
    amb_biome_forgotten_catacombs_loop_01)
      render_ambient "$src" 74 8.0
      ;;
    amb_biome_molten_caverns_loop_01)
      render_ambient "$src" 62 8.0
      ;;
    amb_biome_frozen_halls_loop_01)
      render_ambient "$src" 98 8.0
      ;;
    amb_biome_bone_throne_loop_01)
      render_ambient "$src" 55 8.0
      ;;

    sfx_combat_hit_01)
      render_dual_tone "$src" 260 390 0.14 0.23 0.10
      ;;
    sfx_combat_crit_01)
      render_dual_tone "$src" 420 680 0.19 0.20 0.12
      ;;
    sfx_combat_death_01)
      render_dual_tone "$src" 170 120 0.42 0.18 0.12
      ;;
    sfx_boss_phase_change_01)
      render_dual_tone "$src" 220 520 0.45 0.18 0.10
      ;;

    sfx_skill_cleave_01)
      render_dual_tone "$src" 240 360 0.24 0.22 0.09
      ;;
    sfx_skill_shield_slam_01)
      render_dual_tone "$src" 180 260 0.26 0.20 0.10
      ;;
    sfx_skill_quake_strike_01)
      render_dual_tone "$src" 140 220 0.34 0.22 0.10
      ;;
    sfx_skill_execution_drive_01)
      render_dual_tone "$src" 250 410 0.26 0.18 0.09
      ;;
    sfx_skill_shadow_step_01)
      render_dual_tone "$src" 520 760 0.20 0.16 0.08
      ;;
    sfx_skill_blade_fan_01)
      render_dual_tone "$src" 430 610 0.20 0.14 0.08
      ;;
    sfx_skill_mark_prey_01)
      render_dual_tone "$src" 370 520 0.22 0.14 0.08
      ;;
    sfx_skill_venom_volley_01)
      render_dual_tone "$src" 300 470 0.22 0.16 0.08
      ;;
    sfx_skill_wind_dash_01)
      render_dual_tone "$src" 540 740 0.16 0.10 0.07
      ;;
    sfx_skill_blood_drain_01)
      render_dual_tone "$src" 210 290 0.30 0.20 0.09
      ;;
    sfx_skill_frost_nova_01)
      render_dual_tone "$src" 350 700 0.30 0.16 0.09
      ;;
    sfx_skill_chain_lightning_01)
      render_dual_tone "$src" 620 900 0.18 0.12 0.08
      ;;
    sfx_skill_spirit_burst_01)
      render_dual_tone "$src" 320 560 0.24 0.14 0.08
      ;;
    sfx_skill_rift_step_01)
      render_dual_tone "$src" 560 840 0.18 0.10 0.07
      ;;
    sfx_skill_war_cry_01)
      render_dual_tone "$src" 180 270 0.34 0.22 0.10
      ;;

    sfx_hazard_lava_trigger_01)
      render_dual_tone "$src" 120 210 0.26 0.20 0.09
      ;;
    sfx_hazard_ice_trigger_01)
      render_dual_tone "$src" 440 660 0.22 0.16 0.08
      ;;
    sfx_hazard_spike_trigger_01)
      render_dual_tone "$src" 280 460 0.18 0.22 0.09
      ;;

    sfx_consumable_health_potion_01)
      render_dual_tone "$src" 300 460 0.24 0.15 0.07
      ;;
    sfx_consumable_mana_potion_01)
      render_dual_tone "$src" 360 540 0.24 0.15 0.07
      ;;
    sfx_consumable_scroll_mapping_01)
      render_dual_tone "$src" 480 720 0.30 0.12 0.06
      ;;

    ui_floor_enter_01)
      render_dual_tone "$src" 300 420 0.28 0.14 0.07
      ;;
    ui_biome_enter_01)
      render_dual_tone "$src" 260 520 0.32 0.14 0.07
      ;;
    ui_loot_rare_drop_01)
      render_dual_tone "$src" 520 760 0.24 0.10 0.06
      ;;
    ui_build_formed_01)
      render_dual_tone "$src" 280 440 0.30 0.16 0.08
      ;;
    ui_boss_reward_open_01)
      render_dual_tone "$src" 190 330 0.36 0.18 0.09
      ;;
    ui_equipment_compare_open_01)
      render_dual_tone "$src" 360 540 0.24 0.14 0.07
      ;;

    ui_merchant_open_01)
      render_dual_tone "$src" 330 550 0.26 0.13 0.06
      ;;
    ui_merchant_buy_01)
      render_dual_tone "$src" 420 640 0.20 0.12 0.06
      ;;
    ui_merchant_fail_01)
      render_dual_tone "$src" 220 170 0.20 0.14 0.08
      ;;

    ui_event_*)
      render_dual_tone "$src" 360 520 0.22 0.13 0.07
      ;;

    *)
      render_tone "$src" 320 0.24 0.10
      ;;
  esac
}

source_needs_regen() {
  local id="$1"
  local src="$2"

  if [[ ! -f "$src" ]]; then
    return 0
  fi

  local duration
  duration="$(probe_duration "$src")"
  local peak
  peak="$(probe_peak_abs "$src")"

  if float_gt "$peak" "1.05"; then
    return 0
  fi

  if [[ "$id" == amb_* ]] && float_lt "$duration" "3"; then
    return 0
  fi

  if [[ "$id" != amb_* ]] && float_lt "$duration" "0.06"; then
    return 0
  fi

  return 1
}

node -e '
const fs = require("node:fs");
const manifestPath = process.argv[1];
const entries = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const e of entries) {
  process.stdout.write(`${e.id}\t${e.sourceRef}\t${e.outputPath}\n`);
}
' "$MANIFEST" | while IFS=$'\t' read -r id source_ref output_path; do
  src="$SOURCE_DIR/$source_ref"
  dst="$ROOT_DIR/$output_path"

  mkdir -p "$(dirname "$dst")"

  if [[ "${FORCE_PROCEDURAL_AUDIO:-0}" == "1" ]] || source_needs_regen "$id" "$src"; then
    echo "[sync_audio_assets] regenerating clean source for $id"
    generate_procedural_source "$id" "$src"
  fi

  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -nostdin -v error -i "$src" -ac 1 -ar 48000 \
      -af "highpass=f=40,lowpass=f=14000,loudnorm=I=-32:TP=-6:LRA=9,alimiter=limit=0.90" \
      -c:a libvorbis -q:a 5 -y "$dst"
  else
    cp "$src" "$dst"
  fi

  echo "[sync_audio_assets] $id -> $output_path"
done

echo "Audio assets synced to apps/game-client/public/audio"
