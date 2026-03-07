import type { MetaProgression, PlayerState } from "@blodex/core";
import { renderBossHealthBar } from "../components/BossHealthBar";
import { renderHudPanel } from "../components/HudPanel";
import { t } from "../../i18n";
import { difficultyLabel } from "../../i18n/labelResolvers";
import type { HudStatHighlight } from "./compare/StatDeltaHighlighter";

export interface HudPanelRenderState {
  player: PlayerState;
  run: {
    floor: number;
    difficulty?: string;
    runMode?: "normal" | "daily";
    inEndless?: boolean;
    endlessFloor?: number;
    endlessMutators?: string[];
    biome?: string;
    kills: number;
    lootCollected: number;
    targetKills: number;
    obols?: number;
    floorGoalReached?: boolean;
    isBossFloor?: boolean;
    bossHealth?: number;
    bossMaxHealth?: number;
    bossPhase?: number;
    mappingRevealed?: boolean;
    levelUpPulseLevel?: number;
    statHighlights?: HudStatHighlight[];
  };
  meta: MetaProgression;
}

export interface HudPanelRenderOutput {
  metaHtml: string;
  statsHtml: string;
  runHtml: string;
  bossBarHtml: string;
  lowHealth: boolean;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toPercent(current: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }
  const ratio = current / max;
  return Math.min(100, Math.max(0, ratio * 100));
}

function directionToDeltaClass(direction: "up" | "down" | "equal"): string {
  switch (direction) {
    case "up":
      return "delta-up";
    case "down":
      return "delta-down";
    case "equal":
      return "delta-equal";
  }
}

export function buildHudPanelRenderOutput(state: HudPanelRenderState): HudPanelRenderOutput {
  const player = state.player;
  const hpPercent = toPercent(player.health, player.derivedStats.maxHealth);
  const manaPercent = toPercent(player.mana, player.derivedStats.maxMana);
  const xpPercent = toPercent(player.xp, player.xpToNextLevel);
  const lowHealth = hpPercent <= 25;
  const levelUpPulseLevel = state.run.levelUpPulseLevel;
  const levelUpPulseActive = levelUpPulseLevel !== undefined;
  const statHighlightByKey = new Map(
    (state.run.statHighlights ?? []).map((entry) => [entry.key, entry.direction] as const)
  );
  const attackPowerHighlightClass =
    statHighlightByKey.get("attackPower") === undefined
      ? ""
      : directionToDeltaClass(statHighlightByKey.get("attackPower")!);
  const armorHighlightClass =
    statHighlightByKey.get("armor") === undefined ? "" : directionToDeltaClass(statHighlightByKey.get("armor")!);
  const critHighlightClass =
    statHighlightByKey.get("critChance") === undefined
      ? ""
      : directionToDeltaClass(statHighlightByKey.get("critChance")!);

  const metaHtml = `
    <div class="hud-meta-grid">
      <div class="hud-meta-item">
        <span class="hud-meta-label">${t("ui.hud.meta.runs")}</span>
        <span class="hud-meta-value">${state.meta.runsPlayed}</span>
      </div>
      <div class="hud-meta-item">
        <span class="hud-meta-label">${t("ui.hud.meta.best_floor")}</span>
        <span class="hud-meta-value">${state.meta.bestFloor}</span>
      </div>
      <div class="hud-meta-item">
        <span class="hud-meta-label">${t("ui.hud.meta.best_time")}</span>
        <span class="hud-meta-value">${(state.meta.bestTimeMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  `;

  const statsHtml = `
    <h2>${t("ui.hud.player.title")}</h2>
    <div class="player-bars">
      <div class="player-bar-row ${lowHealth ? "low-health" : ""}">
        <div class="player-bar-head">
          <span>${t("ui.hud.player.hp")}</span>
          <span>${Math.floor(player.health)}/${Math.floor(player.derivedStats.maxHealth)}</span>
        </div>
        <div class="player-bar-track">
          <div class="player-bar-fill hp" style="width:${hpPercent.toFixed(2)}%;"></div>
        </div>
      </div>
      <div class="player-bar-row">
        <div class="player-bar-head">
          <span>${t("ui.hud.player.mana")}</span>
          <span>${Math.floor(player.mana)}/${Math.floor(player.derivedStats.maxMana)}</span>
        </div>
        <div class="player-bar-track">
          <div class="player-bar-fill mana" style="width:${manaPercent.toFixed(2)}%;"></div>
        </div>
      </div>
      <div class="player-bar-row ${levelUpPulseActive ? "level-up-pulse" : ""}">
        <div class="player-bar-head">
          <span>${t("ui.hud.player.xp")}</span>
          <span>${player.xp}/${player.xpToNextLevel}</span>
        </div>
        <div class="player-bar-track">
          <div class="player-bar-fill xp" style="width:${xpPercent.toFixed(2)}%;"></div>
        </div>
      </div>
    </div>
    ${
      levelUpPulseActive
        ? `<div class="level-up-banner">${escapeHtml(
            t("ui.hud.player.level_up", { level: levelUpPulseLevel ?? player.level })
          )}</div>`
        : ""
    }
    <div class="mini-grid mini-2">
      <div><span class="k">${t("ui.hud.player.level")}</span><span>${player.level}</span></div>
      <div class="hud-stat-cell ${attackPowerHighlightClass}">
        <span class="k">${t("ui.hud.player.power")}</span>
        <span>${Math.floor(player.derivedStats.attackPower)}</span>
      </div>
      <div class="hud-stat-cell ${armorHighlightClass}">
        <span class="k">${t("ui.hud.player.armor")}</span>
        <span>${Math.floor(player.derivedStats.armor)}</span>
      </div>
      <div class="hud-stat-cell ${critHighlightClass}">
        <span class="k">${t("ui.hud.player.crit")}</span>
        <span>${(player.derivedStats.critChance * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;

  const modeLabel =
    state.run.inEndless === true
      ? state.run.endlessFloor === undefined
        ? t("ui.hud.run.mode.abyss_base")
        : t("ui.hud.run.mode.abyss", { floor: state.run.endlessFloor })
      : state.run.runMode === "daily"
        ? t("ui.hud.run.mode.daily")
        : difficultyLabel(state.run.difficulty ?? "normal");
  const runBody = `
    <div class="mini-grid mini-2">
      <div><span class="k">${t("ui.hud.run.floor")}</span><span>${state.run.floor}</span></div>
      <div><span class="k">${t("ui.hud.run.mode")}</span><span>${modeLabel}</span></div>
      <div><span class="k">${t("ui.hud.run.biome")}</span><span>${state.run.biome ?? "-"}</span></div>
      <div><span class="k">${t("ui.hud.run.status")}</span><span class="${
        player.health <= 0 ? "badge-danger" : "badge-ok"
      }">${player.health <= 0 ? t("ui.hud.run.status.dead") : t("ui.hud.run.status.hunting")}</span></div>
      <div><span class="k">${t("ui.hud.run.kills")}</span><span>${state.run.kills}/${state.run.targetKills}</span></div>
      <div><span class="k">${t("ui.hud.run.loot")}</span><span>${state.run.lootCollected}</span></div>
      <div><span class="k">${t("ui.hud.run.obol")}</span><span>${state.run.obols ?? 0}</span></div>
      <div><span class="k">${t("ui.hud.run.goal")}</span><span>${state.run.floorGoalReached ? t("ui.hud.run.goal.stairs_up") : t("ui.hud.run.goal.hunt")}</span></div>
    </div>
    ${
      state.run.mappingRevealed
        ? `<div class="mapping-hint">${t("ui.hud.run.mapping_hint")}</div>`
        : ""
    }
    ${
      lowHealth
        ? `<div class="critical-health-hint">${t("ui.hud.run.critical_hint")}</div>`
        : ""
    }
    ${
      (state.run.endlessMutators?.length ?? 0) > 0
        ? `<div class="mapping-hint">${escapeHtml(
            t("ui.hud.run.mutators", { mutators: state.run.endlessMutators?.join(", ") ?? "" })
          )}</div>`
        : ""
    }
  `;

  return {
    metaHtml,
    statsHtml,
    runHtml: renderHudPanel(t("ui.hud.run.title"), runBody),
    bossBarHtml: renderBossHealthBar(state.run),
    lowHealth
  };
}
