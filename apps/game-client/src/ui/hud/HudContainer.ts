import type {
  ConsumableId,
  EquipmentSlot,
  ItemInstance,
  MerchantOffer,
  MetaProgression,
  PlayerState,
  RandomEventDef,
  RunSummary
} from "@blodex/core";
import { calculateItemPowerScore as calculateTradeoffItemPowerScore, canEquip } from "@blodex/core";
import {
  detectPreferredImageFormat,
  resolveGeneratedAssetUrl,
  resolveGeneratedPngFallback
} from "../../assets/imageAsset";
import { renderBossHealthBar } from "../components/BossHealthBar";
import {
  bindEventDialogActions,
  bindMerchantDialogActions,
  renderEventDialog,
  renderMerchantDialog,
  type EventChoiceView
} from "../components/EventDialog";
import {
  bindEquipmentComparePromptActions,
  renderEquipmentComparePrompt,
  type EquipmentComparePromptAffixLine,
  type EquipmentComparePromptSummaryLine
} from "../components/EquipmentComparePrompt";
import { renderHeartbeatToast, type HeartbeatToastView } from "../components/HeartbeatToast";
import { renderHudPanel } from "../components/HudPanel";
import {
  bindConsumableBarActions,
  renderSkillBar
} from "../components/SkillBar";
import {
  bindRunSummaryActions,
  renderRunSummaryScreen
} from "../components/RunSummaryScreen";
import type { RunOutcomeAnalysis } from "../../scenes/dungeon/taste/RunOutcomeAnalyzer";
import { getContentLocalizer, t } from "../../i18n";
import { difficultyLabel } from "../../i18n/labelResolvers";
import {
  resolveDeltaDirection,
  type DeltaDirection,
  type EquipmentDeltaSummaryKey
} from "./compare/EquipmentDeltaPresenter";
import {
  buildEquipmentCompareView,
  summaryDirectionSymbol,
  summaryKeyLabelKey
} from "./compare/EquipmentCompareViewPresenter";
import type { HudStatHighlight } from "./compare/StatDeltaHighlighter";

interface HudState {
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
    consumables?: Array<{
      id: ConsumableId;
      name: string;
      description?: string;
      hotkey: string;
      iconId: string;
      charges: number;
      cooldownLeftMs: number;
      baseCooldownMs?: number;
      disabledReason?: string;
    }>;
    skillSlots?: Array<{
      id?: string;
      hotkey: string;
      name: string;
      description?: string;
      iconId?: string;
      cooldownLeftMs: number;
      baseCooldownMs?: number;
      manaCost?: number;
      targeting?: string;
      range?: number;
      cooldownProgress?: number;
      readyFlash?: boolean;
      outOfMana: boolean;
      locked: boolean;
    }>;
    newlyAcquiredItemIds?: string[];
    levelUpPulseLevel?: number;
    statHighlights?: HudStatHighlight[];
  };
  meta: MetaProgression;
}

export type LogLevel = "info" | "success" | "warn" | "danger";

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  timestampMs: number;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "helm", "chest", "boots", "ring"];
const MAX_LOG_ENTRIES = 200;
const AFFIX_LABEL_KEYS: Readonly<Record<string, string>> = {
  maxHealth: "ui.hud.affix.maxHealth",
  maxMana: "ui.hud.affix.maxMana",
  armor: "ui.hud.affix.armor",
  attackPower: "ui.hud.affix.attackPower",
  critChance: "ui.hud.affix.critChance",
  attackSpeed: "ui.hud.affix.attackSpeed",
  moveSpeed: "ui.hud.affix.moveSpeed",
  lifesteal: "ui.hud.affix.lifesteal",
  critDamage: "ui.hud.affix.critDamage",
  aoeRadius: "ui.hud.affix.aoeRadius",
  skillBonusDamage: "ui.hud.affix.skillBonusDamage",
  thorns: "ui.hud.affix.thorns",
  healthRegen: "ui.hud.affix.healthRegen",
  dodgeChance: "ui.hud.affix.dodgeChance",
  xpBonus: "ui.hud.affix.xpBonus",
  soulShardBonus: "ui.hud.affix.soulShardBonus",
  cooldownReduction: "ui.hud.affix.cooldownReduction"
};
const RARITY_LABEL_KEYS: Readonly<Record<string, string>> = {
  common: "ui.hud.rarity.common",
  magic: "ui.hud.rarity.magic",
  rare: "ui.hud.rarity.rare"
};
const WEAPON_TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  sword: "ui.hud.weapon_type.sword",
  axe: "ui.hud.weapon_type.axe",
  dagger: "ui.hud.weapon_type.dagger",
  staff: "ui.hud.weapon_type.staff",
  hammer: "ui.hud.weapon_type.hammer",
  sword_master: "ui.hud.weapon_type.sword_master"
};

function slotLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return t("ui.hud.inventory.slot.weapon.short");
    case "helm":
      return t("ui.hud.inventory.slot.helm.short");
    case "chest":
      return t("ui.hud.inventory.slot.chest.short");
    case "boots":
      return t("ui.hud.inventory.slot.boots.short");
    case "ring":
      return t("ui.hud.inventory.slot.ring.short");
  }
}

function slotLongLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return t("ui.hud.inventory.slot.weapon.long");
    case "helm":
      return t("ui.hud.inventory.slot.helm.long");
    case "chest":
      return t("ui.hud.inventory.slot.chest.long");
    case "boots":
      return t("ui.hud.inventory.slot.boots.long");
    case "ring":
      return t("ui.hud.inventory.slot.ring.long");
  }
}

function formatAffixNameFallback(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function localizeAffixName(key: string): string {
  const i18nKey = AFFIX_LABEL_KEYS[key];
  if (i18nKey === undefined) {
    return formatAffixNameFallback(key);
  }
  const localized = t(i18nKey);
  return localized === i18nKey ? formatAffixNameFallback(key) : localized;
}

function localizeRarity(rarity: string): string {
  const i18nKey = RARITY_LABEL_KEYS[rarity];
  if (i18nKey === undefined) {
    return rarity.toUpperCase();
  }
  const localized = t(i18nKey);
  return localized === i18nKey ? rarity.toUpperCase() : localized;
}

function localizeWeaponType(weaponType: string): string {
  const i18nKey = WEAPON_TYPE_LABEL_KEYS[weaponType];
  if (i18nKey === undefined) {
    return weaponType.toUpperCase();
  }
  const localized = t(i18nKey);
  return localized === i18nKey ? weaponType.toUpperCase() : localized;
}

function formatAffixValue(key: string, value: number): string {
  const absolute = Math.abs(value);
  const normalized = Number.isInteger(absolute) ? absolute.toString() : absolute.toFixed(1);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const percentValue = `${(absolute * 100).toFixed(1)}%`;
  if (
    key === "critChance" ||
    key === "lifesteal" ||
    key === "critDamage" ||
    key === "aoeRadius" ||
    key === "dodgeChance" ||
    key === "xpBonus" ||
    key === "soulShardBonus" ||
    key === "cooldownReduction"
  ) {
    return `${prefix}${percentValue}`;
  }
  if (key === "healthRegen") {
    return `${prefix}${normalized}/s`;
  }
  return `${prefix}${normalized}`;
}

function formatSignedValue(value: number): string {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  if (value > 0) {
    return `+${normalized}`;
  }
  return normalized;
}

function directionToDeltaClass(direction: DeltaDirection): string {
  switch (direction) {
    case "up":
      return "delta-up";
    case "down":
      return "delta-down";
    case "equal":
      return "delta-equal";
  }
}

function directionSymbol(direction: DeltaDirection): string {
  switch (direction) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "equal":
      return "≈";
  }
}

function directionToPromptTone(direction: DeltaDirection): "positive" | "negative" | "neutral" {
  switch (direction) {
    case "up":
      return "positive";
    case "down":
      return "negative";
    case "equal":
      return "neutral";
  }
}

function summaryLabel(key: EquipmentDeltaSummaryKey): string {
  switch (key) {
    case "offense":
      return t("ui.hud.tooltip.summary.offense");
    case "defense":
      return t("ui.hud.tooltip.summary.defense");
    case "utility":
      return t("ui.hud.tooltip.summary.utility");
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRunTimestamp(timestampMs: number): string {
  const seconds = Math.max(0, timestampMs / 1000);
  return `T+${seconds.toFixed(1)}s`;
}

function parseTooltipNumber(raw: string | undefined): number {
  if (raw === undefined) {
    return 0;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function formatCooldownLabel(cooldownLeftMs: number): string {
  return cooldownLeftMs > 0
    ? t("ui.hud.cooldown.label", {
        seconds: (cooldownLeftMs / 1000).toFixed(1)
      })
    : t("ui.hud.cooldown.ready");
}

function formatTargetingLabel(targeting: string, range: number): string {
  const roundedRange = Number.isFinite(range) && range > 0 ? Number.parseFloat(range.toFixed(1)) : 0;
  if (targeting === "self") {
    return t("ui.hud.targeting.self");
  }
  if (targeting === "nearest") {
    return roundedRange > 0
      ? t("ui.hud.targeting.nearest_enemy_range", { range: roundedRange })
      : t("ui.hud.targeting.nearest_enemy");
  }
  if (targeting === "aoe_around") {
    return roundedRange > 0
      ? t("ui.hud.targeting.around_you_radius", { radius: roundedRange })
      : t("ui.hud.targeting.around_you");
  }
  if (targeting === "directional") {
    return roundedRange > 0
      ? t("ui.hud.targeting.directional_range", { range: roundedRange })
      : t("ui.hud.targeting.directional");
  }
  return t("ui.hud.targeting.unknown");
}

function toPercent(current: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }
  const ratio = current / max;
  return Math.min(100, Math.max(0, ratio * 100));
}

export class HudContainer {
  private readonly metaEl = document.querySelector("#meta") as HTMLDivElement;
  private readonly hudCriticalEl = document.querySelector("#hud-critical") as HTMLDivElement | null;
  private readonly statsEl = document.querySelector("#stats") as HTMLDivElement;
  private readonly runEl = document.querySelector("#run") as HTMLDivElement;
  private readonly bossBarEl = document.querySelector("#boss-bar") as HTMLDivElement;
  private readonly skillBarEl = document.querySelector("#skillbar") as HTMLDivElement;
  private readonly inventoryEl = document.querySelector("#inventory") as HTMLDivElement;
  private readonly logEl = document.querySelector("#log") as HTMLDivElement;
  private readonly summaryEl = document.querySelector("#run-summary-overlay") as HTMLDivElement;
  private readonly deathOverlayEl = document.querySelector("#death-overlay") as HTMLDivElement;
  private readonly eventPanelEl = document.querySelector("#event-panel") as HTMLDivElement;
  private readonly heartbeatToastEl = document.querySelector("#heartbeat-toast-layer") as HTMLDivElement;
  private readonly equipmentCompareEl = document.querySelector("#equipment-compare-overlay") as HTMLDivElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly preferredImageFormat = detectPreferredImageFormat();
  private readonly contentLocalizer = getContentLocalizer();

  private logEntries: LogEntry[] = [];
  private nextLogId = 1;
  private heartbeatToastTimeoutId: number | null = null;
  private readonly onSummaryContinueKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    this.onNewRun();
  };

  constructor(
    private readonly onEquip: (itemId: string) => void,
    private readonly onUnequip: (slot: EquipmentSlot) => void,
    private readonly onDiscard: (itemId: string) => void,
    private readonly onUseConsumable: (consumableId: ConsumableId) => void,
    private readonly onNewRun: () => void
  ) {
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "inventory-tooltip hidden";
    document.body.appendChild(this.tooltipEl);
    this.bossBarEl.className = "hidden";
    this.skillBarEl.className = "hidden";
    this.renderLogPanel();
    this.hideDeathOverlay();
    this.hideEventPanel();
    this.hideHeartbeatToast();
    this.hideEquipmentComparePrompt();
  }

  render(state: HudState): void {
    this.metaEl.className = "panel-block compact-block";
    this.metaEl.innerHTML = `
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
    this.hudCriticalEl?.classList.toggle("low-health-critical", lowHealth);
    document.body.classList.toggle("low-health-critical", lowHealth);
    this.statsEl.className = "panel-block compact-block";
    this.statsEl.innerHTML = `
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

    this.runEl.className = "panel-block compact-block";
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
    this.runEl.innerHTML = renderHudPanel(t("ui.hud.run.title"), runBody);

    const bossBarHtml = renderBossHealthBar(state.run);
    if (bossBarHtml.length === 0) {
      this.bossBarEl.className = "hidden";
      this.bossBarEl.innerHTML = "";
    } else {
      this.bossBarEl.className = "";
      this.bossBarEl.innerHTML = bossBarHtml;
    }

    const hasSkillbarContent =
      (state.run.consumables?.length ?? 0) > 0 || (state.run.skillSlots?.length ?? 0) > 0;
    if (!hasSkillbarContent) {
      this.skillBarEl.className = "hidden";
      this.skillBarEl.innerHTML = "";
      this.hideTooltip();
    } else {
      this.skillBarEl.className = "skillbar-root";
      this.skillBarEl.innerHTML = renderSkillBar(
        {
          ...(state.run.consumables === undefined ? {} : { consumables: state.run.consumables }),
          ...(state.run.skillSlots === undefined ? {} : { skillSlots: state.run.skillSlots })
        },
        this.preferredImageFormat
      );
      this.bindGeneratedImageFallbacks(this.skillBarEl);
      bindConsumableBarActions(this.skillBarEl, this.onUseConsumable);
      this.bindQuickbarTooltips();
    }

    this.renderInventory(player, state.run.newlyAcquiredItemIds ?? []);
  }

  appendLog(message: string, level: LogLevel = "info", timestampMs = performance.now()): void {
    this.logEntries.push({
      id: this.nextLogId,
      level,
      message,
      timestampMs
    });
    this.nextLogId += 1;

    if (this.logEntries.length > MAX_LOG_ENTRIES) {
      this.logEntries = this.logEntries.slice(this.logEntries.length - MAX_LOG_ENTRIES);
    }
    this.renderLogPanel();
  }

  clearLogs(): void {
    this.logEntries = [];
    this.nextLogId = 1;
    this.renderLogPanel();
  }

  getLogEntries(): readonly LogEntry[] {
    return this.logEntries;
  }

  showDeathOverlay(reason: string): void {
    this.deathOverlayEl.classList.remove("hidden");
    this.deathOverlayEl.innerHTML = `
      <div class="death-card">
        <h2>${t("ui.hud.death.title")}</h2>
        <p class="death-card-subtitle">${t("ui.hud.death.subtitle")}</p>
        <p class="death-card-reason">${escapeHtml(reason)}</p>
      </div>
    `;
  }

  hideDeathOverlay(): void {
    this.deathOverlayEl.classList.add("hidden");
    this.deathOverlayEl.innerHTML = "";
  }

  private renderInventory(player: PlayerState, newlyAcquiredItemIds: string[]): void {
    const itemById = new Map<string, ItemInstance>();
    for (const item of player.inventory) {
      itemById.set(item.id, item);
    }
    const newlyAcquiredSet = new Set(newlyAcquiredItemIds);
    for (const item of Object.values(player.equipment)) {
      if (item !== undefined) {
        itemById.set(item.id, item);
      }
    }

    this.inventoryEl.className = "panel-block compact-block inventory-panel";

    const equipmentGrid = EQUIPMENT_SLOTS.map((slot) => {
      const equipped = player.equipment[slot];
      if (equipped === undefined) {
        return `
          <div class="equip-slot empty">
            <div class="equip-slot-name">${slotLabel(slot)}</div>
            <div class="equip-slot-empty">-</div>
          </div>
        `;
      }
      const equippedName = this.contentLocalizer.itemName(equipped.defId, equipped.name);

      return `
        <div class="equip-slot filled ${equipped.rarity}" data-item-id="${equipped.id}">
          <div class="equip-slot-head">
            <div class="equip-slot-name">${slotLabel(slot)}</div>
            <button data-unequip-slot="${slot}" title="${escapeHtml(
              t("ui.hud.inventory.unequip", { slot: slotLongLabel(slot) })
            )}">×</button>
          </div>
          <img class="item-icon" data-asset-id="${equipped.iconId}" src="${resolveGeneratedAssetUrl(
            equipped.iconId,
            this.preferredImageFormat
          )}" alt="${escapeHtml(equippedName)}" />
        </div>
      `;
    }).join("");

    const inventoryGrid = player.inventory
      .map((item) => {
        const itemName = this.contentLocalizer.itemName(item.defId, item.name);
        const equipable = canEquip(player, item);
        const compareItem = player.equipment[item.slot];
        const powerDelta =
          compareItem === undefined
            ? 0
            : calculateTradeoffItemPowerScore(item) - calculateTradeoffItemPowerScore(compareItem);
        const isDowngrade = equipable && compareItem !== undefined && powerDelta < 0;
        const newlyAcquiredClass = newlyAcquiredSet.has(item.id) ? "newly-acquired" : "";
        const equipActionTitle = equipable
          ? isDowngrade
            ? t("ui.hud.inventory.equip_downgrade", {
                item: itemName,
                delta: formatSignedValue(powerDelta)
              })
            : t("ui.hud.inventory.equip", { item: itemName })
          : t("ui.hud.inventory.need_level", { level: item.requiredLevel });
        return `
          <div class="inventory-cell ${item.rarity} ${equipable ? "" : "locked"} ${newlyAcquiredClass}" data-item-id="${item.id}">
            <img class="item-icon" data-asset-id="${item.iconId}" src="${resolveGeneratedAssetUrl(
              item.iconId,
              this.preferredImageFormat
            )}" alt="${escapeHtml(itemName)}" />
            <div class="inventory-cell-actions">
              <button
                class="${equipable ? "" : "blocked"} ${isDowngrade ? "downgrade" : ""}"
                data-item-id="${item.id}"
                title="${escapeHtml(equipActionTitle)}"
              >${equipable ? "E" : escapeHtml(t("ui.hud.inventory.need_level_short", { level: item.requiredLevel }))}</button>
              <button
                class="discard"
                data-discard-item-id="${item.id}"
                title="${escapeHtml(t("ui.hud.inventory.discard", { item: itemName }))}"
              >D</button>
            </div>
            ${
              isDowngrade
                ? `<small class="equip-downgrade-hint">${escapeHtml(
                    t("ui.hud.inventory.downgrade_hint", {
                      delta: formatSignedValue(powerDelta)
                    })
                  )}</small>`
                : ""
            }
            ${equipable ? "" : `<small class="equip-lock-hint">${escapeHtml(
              t("ui.hud.inventory.equip_lock_hint", {
                level: item.requiredLevel
              })
            )}</small>`}
          </div>
        `;
      })
      .join("");

    this.inventoryEl.innerHTML = `
      <h2>${t("ui.hud.inventory.title")}</h2>
      <div class="equipment-grid">${equipmentGrid}</div>
      <div class="inventory-subhead">${t("ui.hud.inventory.subhead", { count: player.inventory.length })}</div>
      <div class="inventory-scroll">
        <div class="inventory-grid">${inventoryGrid || `<div class="inventory-empty">${escapeHtml(
          t("ui.hud.inventory.empty")
        )}</div>`}</div>
      </div>
    `;
    this.bindGeneratedImageFallbacks(this.inventoryEl);

    this.inventoryEl.querySelectorAll("button[data-item-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = (button as HTMLButtonElement).dataset.itemId;
        if (id !== undefined) {
          this.onEquip(id);
        }
      });
    });

    this.inventoryEl.querySelectorAll("button[data-unequip-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        const slot = (button as HTMLButtonElement).dataset.unequipSlot as EquipmentSlot | undefined;
        if (slot !== undefined) {
          this.onUnequip(slot);
        }
      });
    });

    this.inventoryEl.querySelectorAll("button[data-discard-item-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = (button as HTMLButtonElement).dataset.discardItemId;
        if (id !== undefined) {
          this.hideTooltip();
          this.onDiscard(id);
        }
      });
    });

    this.inventoryEl.querySelectorAll<HTMLElement>("[data-item-id]").forEach((element) => {
      element.addEventListener("mouseenter", (event) => {
        const itemId = element.dataset.itemId;
        if (itemId === undefined) {
          return;
        }
        const item = itemById.get(itemId);
        if (item === undefined) {
          return;
        }
        this.showTooltip(
          item,
          player.equipment[item.slot]?.id === item.id ? undefined : player.equipment[item.slot],
          event as MouseEvent
        );
      });

      element.addEventListener("mousemove", (event) => {
        const itemId = element.dataset.itemId;
        if (itemId === undefined) {
          return;
        }
        const item = itemById.get(itemId);
        if (item === undefined) {
          return;
        }
        this.showTooltip(
          item,
          player.equipment[item.slot]?.id === item.id ? undefined : player.equipment[item.slot],
          event as MouseEvent
        );
      });

      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
    });
  }

  private renderLogPanel(): void {
    this.logEl.className = "panel-block log-panel";
    const rows = [...this.logEntries]
      .reverse()
      .map(
        (entry) => `
          <div class="log-entry ${entry.level}" data-log-id="${entry.id}">
            <p class="log-message">${escapeHtml(entry.message)}</p>
            <small class="log-time">${formatRunTimestamp(entry.timestampMs)}</small>
          </div>
        `
      )
      .join("");
    this.logEl.innerHTML = `
      <h2>${t("ui.hud.log.title")}</h2>
      <div class="log-list">
        ${rows || `<p class="log-empty">${escapeHtml(t("ui.hud.log.empty"))}</p>`}
      </div>
    `;
  }

  private bindGeneratedImageFallbacks(container: ParentNode): void {
    container.querySelectorAll<HTMLImageElement>("img[data-asset-id]").forEach((image) => {
      image.addEventListener("error", () => {
        const assetId = image.dataset.assetId;
        if (assetId === undefined) {
          return;
        }

        if (image.dataset.fallbackApplied === "1") {
          return;
        }

        image.dataset.fallbackApplied = "1";
        image.src = resolveGeneratedPngFallback(assetId);
      });
    });
  }

  private bindQuickbarTooltips(): void {
    this.skillBarEl.querySelectorAll<HTMLElement>("[data-tooltip-kind]").forEach((element) => {
      element.addEventListener("mouseenter", (event) => {
        this.showQuickbarTooltip(element, event as MouseEvent);
      });
      element.addEventListener("mousemove", (event) => {
        this.showQuickbarTooltip(element, event as MouseEvent);
      });
      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
    });
  }

  private showQuickbarTooltip(element: HTMLElement, event: MouseEvent): void {
    const kind = element.dataset.tooltipKind;
    if (kind === "consumable") {
      const name = escapeHtml(element.dataset.tooltipName ?? t("ui.hud.tooltip.consumable_default_name"));
      const descriptionRaw = element.dataset.tooltipDescription ?? "";
      const hotkey = escapeHtml(element.dataset.tooltipHotkey ?? "-");
      const charges = parseTooltipNumber(element.dataset.tooltipCharges);
      const cooldownLeftMs = parseTooltipNumber(element.dataset.tooltipCooldownLeftMs);
      const status = formatCooldownLabel(cooldownLeftMs);
      const disabledReasonRaw = element.dataset.tooltipDisabledReason;
      this.showTooltipHtml(
        `
          <div class="tooltip-name">${name}</div>
          <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.hotkey", { hotkey }))}</div>
          ${
            descriptionRaw.length > 0
              ? `<div class="tooltip-body">${escapeHtml(descriptionRaw)}</div>`
              : ""
          }
          <div class="tooltip-divider"></div>
          <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.charges", { charges }))}</div>
          <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.status", { status }))}</div>
          ${
            disabledReasonRaw === undefined
              ? ""
              : `<div class="tooltip-warning">${escapeHtml(disabledReasonRaw)}</div>`
          }
        `,
        event
      );
      return;
    }

    if (kind === "skill") {
      const name = escapeHtml(element.dataset.tooltipName ?? t("ui.hud.tooltip.skill_default_name"));
      const descriptionRaw = element.dataset.tooltipDescription ?? "";
      const hotkey = escapeHtml(element.dataset.tooltipHotkey ?? "-");
      const cooldownLeftMs = parseTooltipNumber(element.dataset.tooltipCooldownLeftMs);
      const baseCooldownMs = parseTooltipNumber(element.dataset.tooltipBaseCooldownMs);
      const manaCost = parseTooltipNumber(element.dataset.tooltipManaCost);
      const targeting = element.dataset.tooltipTargeting ?? "";
      const range = parseTooltipNumber(element.dataset.tooltipRange);
      const locked = element.dataset.tooltipLocked === "1";
      const outOfMana = element.dataset.tooltipOutOfMana === "1";
      const status = locked ? t("ui.common.locked") : formatCooldownLabel(cooldownLeftMs);
      const targetingLabel = formatTargetingLabel(targeting, range);
      this.showTooltipHtml(
        `
          <div class="tooltip-name">${name}</div>
          <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.hotkey", { hotkey }))}</div>
          ${
            descriptionRaw.length > 0
              ? `<div class="tooltip-body">${escapeHtml(descriptionRaw)}</div>`
              : ""
          }
          <div class="tooltip-divider"></div>
          <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.status", { status }))}</div>
          ${locked ? "" : `<div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.mana_cost", { manaCost }))}</div>`}
          ${locked || baseCooldownMs <= 0 ? "" : `<div class="tooltip-meta">${escapeHtml(
            t("ui.hud.tooltip.base_cd", {
              seconds: (baseCooldownMs / 1000).toFixed(1)
            })
          )}</div>`}
          ${locked ? "" : `<div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.target", { target: targetingLabel }))}</div>`}
          ${!locked && outOfMana ? `<div class="tooltip-warning">${t("ui.hud.tooltip.not_enough_mana")}</div>` : ""}
        `,
        event
      );
    }
  }

  private showTooltipHtml(contentHtml: string, event: MouseEvent): void {
    this.tooltipEl.innerHTML = contentHtml;
    this.tooltipEl.classList.remove("hidden");
    this.positionTooltip(event.clientX, event.clientY);
  }

  private positionTooltip(clientX: number, clientY: number): void {
    const offset = 14;
    const margin = 8;
    const rect = this.tooltipEl.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;
    const nextLeft = Math.max(margin, Math.min(maxLeft, clientX + offset));
    const nextTop = Math.max(margin, Math.min(maxTop, clientY + offset));
    this.tooltipEl.style.left = `${nextLeft}px`;
    this.tooltipEl.style.top = `${nextTop}px`;
  }

  private showTooltip(item: ItemInstance, compareItem: ItemInstance | undefined, event: MouseEvent): void {
    const localizedItemName = this.contentLocalizer.itemName(item.defId, item.name);
    const localizedCompareName =
      compareItem === undefined
        ? undefined
        : this.contentLocalizer.itemName(compareItem.defId, compareItem.name);
    const compareView = buildEquipmentCompareView(item, compareItem);
    const affixLines = compareView.affixLines
      .map((line) => {
        const deltaClass = directionToDeltaClass(line.direction);
        return `
          <div class="tooltip-affix-line">
            <span>${escapeHtml(localizeAffixName(line.key))}</span>
            <span class="tooltip-affix-value ${deltaClass}">${escapeHtml(
              formatAffixValue(line.key, line.value)
            )}${line.delta === undefined ? "" : ` (${escapeHtml(formatSignedValue(line.delta))})`}</span>
          </div>
        `;
      })
      .join("");
    const powerDeltaClass = directionToDeltaClass(compareView.powerDirection);
    const compareSummaryLines =
      compareItem === undefined
        ? []
        : compareView.summaryLines.map((line) => `
            <div class="tooltip-compare-summary-line">
              <span>${escapeHtml(summaryLabel(summaryKeyLabelKey(line.key)))}</span>
              <span class="tooltip-compare-summary-value ${directionToDeltaClass(line.direction)}">${directionSymbol(
                line.direction
              )}</span>
            </div>
          `);

    this.showTooltipHtml(
      `
      <div class="tooltip-name">${escapeHtml(localizedItemName)}</div>
      <div class="tooltip-rarity ${item.rarity}">${escapeHtml(localizeRarity(item.rarity))}</div>
      <div class="tooltip-meta">${escapeHtml(
        t("ui.hud.tooltip.slot", {
          slot: `${slotLongLabel(item.slot)}${
            item.weaponType === undefined ? "" : ` · ${localizeWeaponType(item.weaponType)}`
          }`
        })
      )}</div>
      <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.req_level", { level: item.requiredLevel }))}</div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-affixes">${affixLines || escapeHtml(t("ui.hud.tooltip.no_affixes"))}</div>
      ${
        compareItem === undefined
          ? ""
          : `
            <div class="tooltip-divider"></div>
            <div class="tooltip-compare-head">${escapeHtml(
              t("ui.hud.tooltip.compare", { name: localizedCompareName ?? compareItem.name })
            )}</div>
            <div class="tooltip-compare-summary">
              ${compareSummaryLines.join("")}
            </div>
            <div class="tooltip-compare-score ${powerDeltaClass}">
              ${escapeHtml(
                t("ui.hud.tooltip.power_delta", {
                  delta: formatSignedValue(compareView.powerDelta)
                })
              )}
            </div>
          `
      }
    `,
      event
    );
  }

  private hideTooltip(): void {
    this.tooltipEl.classList.add("hidden");
  }

  showHeartbeatToast(view: HeartbeatToastView): void {
    if (this.heartbeatToastTimeoutId !== null) {
      window.clearTimeout(this.heartbeatToastTimeoutId);
      this.heartbeatToastTimeoutId = null;
    }
    this.heartbeatToastEl.className = "heartbeat-toast-layer";
    this.heartbeatToastEl.innerHTML = renderHeartbeatToast(view);
    this.heartbeatToastTimeoutId = window.setTimeout(() => {
      this.hideHeartbeatToast();
    }, 2_200);
  }

  hideHeartbeatToast(): void {
    if (this.heartbeatToastTimeoutId !== null) {
      window.clearTimeout(this.heartbeatToastTimeoutId);
      this.heartbeatToastTimeoutId = null;
    }
    this.heartbeatToastEl.className = "hidden";
    this.heartbeatToastEl.innerHTML = "";
  }

  showEquipmentComparePrompt(
    item: ItemInstance,
    compareItem: ItemInstance | undefined,
    options: {
      title: string;
      subtitle: string;
      sourceLabel: string;
      onAction: (action: "equip" | "later" | "ignore") => void;
    }
  ): void {
    const compareView = buildEquipmentCompareView(item, compareItem);
    const localizedItemName = this.contentLocalizer.itemName(item.defId, item.name);
    const localizedCompareName =
      compareItem === undefined
        ? undefined
        : this.contentLocalizer.itemName(compareItem.defId, compareItem.name);
    const summaryLines: EquipmentComparePromptSummaryLine[] = compareView.summaryLines.map((line) => ({
      label: summaryLabel(summaryKeyLabelKey(line.key)),
      symbol: summaryDirectionSymbol(line.direction),
      tone: directionToPromptTone(line.direction)
    }));
    const affixLines: EquipmentComparePromptAffixLine[] = compareView.affixLines.map((line) => ({
      label: localizeAffixName(line.key),
      value: formatAffixValue(line.key, line.value),
      ...(line.delta === undefined ? {} : { delta: formatSignedValue(line.delta) }),
      tone: directionToPromptTone(line.direction)
    }));

    this.equipmentCompareEl.className = "equipment-compare-overlay";
    this.equipmentCompareEl.innerHTML = renderEquipmentComparePrompt({
      itemId: item.id,
      title: options.title,
      subtitle: options.subtitle,
      sourceLabel: options.sourceLabel,
      candidateName: localizedItemName,
      ...(localizedCompareName === undefined ? {} : { compareName: localizedCompareName }),
      rarityLabel: localizeRarity(item.rarity),
      powerDeltaLabel: t("ui.hud.tooltip.power_delta", {
        delta: formatSignedValue(compareView.powerDelta)
      }),
      powerDeltaTone: directionToPromptTone(compareView.powerDirection),
      summaryLines,
      affixLines,
      equipNowLabel: t("ui.feedback.compare.equip_now"),
      laterLabel: t("ui.feedback.compare.later"),
      ignoreLabel: t("ui.feedback.compare.ignore")
    });
    bindEquipmentComparePromptActions(this.equipmentCompareEl, (action, itemId) => {
      this.hideEquipmentComparePrompt();
      if (action === "equip" && itemId !== undefined) {
        this.onEquip(itemId);
      }
      options.onAction(action);
    });
  }

  hideEquipmentComparePrompt(): void {
    this.equipmentCompareEl.className = "hidden";
    this.equipmentCompareEl.innerHTML = "";
  }

  showEventPanel(
    eventDef: RandomEventDef,
    choices: EventChoiceView[],
    onChoose: (choiceId: string) => void,
    onClose: () => void
  ): void {
    this.eventPanelEl.className = "event-panel";
    this.eventPanelEl.innerHTML = renderEventDialog(eventDef, choices);
    bindEventDialogActions(this.eventPanelEl, onChoose, onClose);
  }

  showMerchantPanel(
    offers: Array<MerchantOffer & { itemName: string; rarity: string }>,
    onBuy: (offerId: string) => void,
    onClose: () => void
  ): void {
    this.eventPanelEl.className = "event-panel";
    this.eventPanelEl.innerHTML = renderMerchantDialog(offers);
    bindMerchantDialogActions(this.eventPanelEl, onBuy, onClose);
  }

  hideEventPanel(): void {
    this.eventPanelEl.className = "hidden";
    this.eventPanelEl.innerHTML = "";
  }

  showSummary(summary: RunSummary, analysis?: RunOutcomeAnalysis): void {
    this.summaryEl.className = "run-summary-overlay";
    this.summaryEl.innerHTML = renderRunSummaryScreen(summary, analysis);
    bindRunSummaryActions(this.summaryEl, () => this.onNewRun());
    document.addEventListener("keydown", this.onSummaryContinueKeydown);
  }

  clearSummary(): void {
    this.summaryEl.className = "hidden";
    this.summaryEl.innerHTML = "";
    document.removeEventListener("keydown", this.onSummaryContinueKeydown);
    this.hideEventPanel();
    this.hideEquipmentComparePrompt();
  }

  reset(): void {
    this.clearSummary();
    this.hideDeathOverlay();
    this.hideEventPanel();
    this.hideHeartbeatToast();
    this.hideEquipmentComparePrompt();
    this.hideTooltip();
    this.clearLogs();

    this.metaEl.className = "hidden";
    this.metaEl.innerHTML = "";
    this.statsEl.className = "hidden";
    this.statsEl.innerHTML = "";
    this.runEl.className = "hidden";
    this.runEl.innerHTML = "";
    this.bossBarEl.className = "hidden";
    this.bossBarEl.innerHTML = "";
    this.skillBarEl.className = "hidden";
    this.skillBarEl.innerHTML = "";
    this.inventoryEl.className = "hidden";
    this.inventoryEl.innerHTML = "";
    this.logEl.className = "hidden";
    this.logEl.innerHTML = "";
    this.hudCriticalEl?.classList.remove("low-health-critical");
    document.body.classList.remove("low-health-critical");
  }
}
