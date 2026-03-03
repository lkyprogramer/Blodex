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
import { canEquip } from "@blodex/core";
import {
  detectPreferredImageFormat,
  resolveGeneratedAssetUrl,
  resolveGeneratedPngFallback
} from "../assets/imageAsset";
import { renderBossHealthBar } from "./components/BossHealthBar";
import {
  bindEventDialogActions,
  bindMerchantDialogActions,
  renderEventDialog,
  renderMerchantDialog,
  type EventChoiceView
} from "./components/EventDialog";
import { renderHudPanel } from "./components/HudPanel";
import {
  bindConsumableBarActions,
  renderSkillBar
} from "./components/SkillBar";
import {
  bindRunSummaryActions,
  renderRunSummaryScreen
} from "./components/RunSummaryScreen";

interface HudState {
  player: PlayerState;
  run: {
    floor: number;
    difficulty?: string;
    runMode?: "normal" | "daily";
    inEndless?: boolean;
    endlessFloor?: number;
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

function slotLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return "WPN";
    case "helm":
      return "HELM";
    case "chest":
      return "CHEST";
    case "boots":
      return "BOOTS";
    case "ring":
      return "RING";
  }
}

function slotLongLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return "Weapon";
    case "helm":
      return "Helm";
    case "chest":
      return "Chest";
    case "boots":
      return "Boots";
    case "ring":
      return "Ring";
  }
}

function formatAffixName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function formatAffixValue(key: string, value: number): string {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  if (
    key === "lifesteal" ||
    key === "critDamage" ||
    key === "dodgeChance" ||
    key === "xpBonus" ||
    key === "soulShardBonus" ||
    key === "cooldownReduction"
  ) {
    return `+${normalized}%`;
  }
  if (key === "healthRegen") {
    return `+${normalized}/s`;
  }
  return `+${normalized}`;
}

function formatSignedValue(value: number): string {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  if (value > 0) {
    return `+${normalized}`;
  }
  return normalized;
}

function collectItemAffixMap(item: ItemInstance): Map<string, number> {
  const map = new Map<string, number>();
  for (const [key, value] of Object.entries(item.rolledAffixes)) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(item.rolledSpecialAffixes ?? {})) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }
  return map;
}

function calculateItemPowerScore(item: ItemInstance): number {
  let score = 0;
  for (const value of Object.values(item.rolledAffixes)) {
    if (value !== undefined) {
      score += value;
    }
  }
  for (const value of Object.values(item.rolledSpecialAffixes ?? {})) {
    if (value !== undefined) {
      score += value;
    }
  }
  return score;
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
  return cooldownLeftMs > 0 ? `Cooldown ${(cooldownLeftMs / 1000).toFixed(1)}s` : "Ready";
}

function formatTargetingLabel(targeting: string, range: number): string {
  const roundedRange = Number.isFinite(range) && range > 0 ? Number.parseFloat(range.toFixed(1)) : 0;
  if (targeting === "self") {
    return "Self";
  }
  if (targeting === "nearest") {
    return roundedRange > 0 ? `Nearest enemy (${roundedRange} range)` : "Nearest enemy";
  }
  if (targeting === "aoe_around") {
    return roundedRange > 0 ? `Around you (${roundedRange} radius)` : "Around you";
  }
  if (targeting === "directional") {
    return roundedRange > 0 ? `Directional (${roundedRange} range)` : "Directional";
  }
  return "-";
}

function toPercent(current: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }
  const ratio = current / max;
  return Math.min(100, Math.max(0, ratio * 100));
}

export class Hud {
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
  private readonly tooltipEl: HTMLDivElement;
  private readonly preferredImageFormat = detectPreferredImageFormat();

  private logEntries: LogEntry[] = [];
  private nextLogId = 1;
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
  }

  render(state: HudState): void {
    this.metaEl.className = "panel-block compact-block";
    this.metaEl.innerHTML = `
      <div class="mini-grid mini-3">
        <div><span class="k">Runs</span><span>${state.meta.runsPlayed}</span></div>
        <div><span class="k">Best F</span><span>${state.meta.bestFloor}</span></div>
        <div><span class="k">Best T</span><span>${(state.meta.bestTimeMs / 1000).toFixed(1)}s</span></div>
      </div>
    `;

    const player = state.player;
    const hpPercent = toPercent(player.health, player.derivedStats.maxHealth);
    const manaPercent = toPercent(player.mana, player.derivedStats.maxMana);
    const xpPercent = toPercent(player.xp, player.xpToNextLevel);
    const lowHealth = hpPercent <= 25;
    this.hudCriticalEl?.classList.toggle("low-health-critical", lowHealth);
    document.body.classList.toggle("low-health-critical", lowHealth);
    this.statsEl.className = "panel-block compact-block";
    this.statsEl.innerHTML = `
      <h2>Vanguard</h2>
      <div class="player-bars">
        <div class="player-bar-row ${lowHealth ? "low-health" : ""}">
          <div class="player-bar-head">
            <span>HP</span>
            <span>${Math.floor(player.health)}/${Math.floor(player.derivedStats.maxHealth)}</span>
          </div>
          <div class="player-bar-track">
            <div class="player-bar-fill hp" style="width:${hpPercent.toFixed(2)}%;"></div>
          </div>
        </div>
        <div class="player-bar-row">
          <div class="player-bar-head">
            <span>Mana</span>
            <span>${Math.floor(player.mana)}/${Math.floor(player.derivedStats.maxMana)}</span>
          </div>
          <div class="player-bar-track">
            <div class="player-bar-fill mana" style="width:${manaPercent.toFixed(2)}%;"></div>
          </div>
        </div>
        <div class="player-bar-row">
          <div class="player-bar-head">
            <span>XP</span>
            <span>${player.xp}/${player.xpToNextLevel}</span>
          </div>
          <div class="player-bar-track">
            <div class="player-bar-fill xp" style="width:${xpPercent.toFixed(2)}%;"></div>
          </div>
        </div>
      </div>
      <div class="mini-grid mini-3">
        <div><span class="k">Lvl</span><span>${player.level}</span></div>
        <div><span class="k">Pow</span><span>${Math.floor(player.derivedStats.attackPower)}</span></div>
        <div><span class="k">Arm</span><span>${Math.floor(player.derivedStats.armor)}</span></div>
      </div>
    `;

    this.runEl.className = "panel-block compact-block";
    const modeLabel =
      state.run.inEndless === true
        ? `ABYSS${state.run.endlessFloor === undefined ? "" : ` ${state.run.endlessFloor}`}`
        : state.run.runMode === "daily"
          ? "DAILY"
          : (state.run.difficulty ?? "normal").toUpperCase();
    const runBody = `
      <div class="mini-grid mini-2">
        <div><span class="k">Floor</span><span>${state.run.floor}</span></div>
        <div><span class="k">Mode</span><span>${modeLabel}</span></div>
        <div><span class="k">Biome</span><span>${state.run.biome ?? "-"}</span></div>
        <div><span class="k">Status</span><span class="${
          player.health <= 0 ? "badge-danger" : "badge-ok"
        }">${player.health <= 0 ? "Dead" : "Hunting"}</span></div>
        <div><span class="k">Kills</span><span>${state.run.kills}/${state.run.targetKills}</span></div>
        <div><span class="k">Loot</span><span>${state.run.lootCollected}</span></div>
        <div><span class="k">Obol</span><span>${state.run.obols ?? 0}</span></div>
        <div><span class="k">Goal</span><span>${state.run.floorGoalReached ? "Stairs up" : "Hunt"}</span></div>
      </div>
      ${
        state.run.mappingRevealed
          ? `<div class="mapping-hint">Mapping scroll active: objective location revealed.</div>`
          : ""
      }
      ${
        lowHealth
          ? '<div class="critical-health-hint">Critical HP: drink potion or disengage.</div>'
          : ""
      }
    `;
    this.runEl.innerHTML = renderHudPanel("Run State", runBody);

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
        <h2>You Died</h2>
        <p class="death-card-subtitle">The Abyss claims another run.</p>
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

      return `
        <div class="equip-slot filled ${equipped.rarity}" data-item-id="${equipped.id}">
          <div class="equip-slot-head">
            <div class="equip-slot-name">${slotLabel(slot)}</div>
            <button data-unequip-slot="${slot}" title="Unequip ${slotLongLabel(slot)}">×</button>
          </div>
          <img class="item-icon" data-asset-id="${equipped.iconId}" src="${resolveGeneratedAssetUrl(
            equipped.iconId,
            this.preferredImageFormat
          )}" alt="${equipped.name}" />
        </div>
      `;
    }).join("");

    const inventoryGrid = player.inventory
      .map((item) => {
        const equipable = canEquip(player, item);
        const newlyAcquiredClass = newlyAcquiredSet.has(item.id) ? "newly-acquired" : "";
        return `
          <div class="inventory-cell ${item.rarity} ${equipable ? "" : "locked"} ${newlyAcquiredClass}" data-item-id="${item.id}">
            <img class="item-icon" data-asset-id="${item.iconId}" src="${resolveGeneratedAssetUrl(
              item.iconId,
              this.preferredImageFormat
            )}" alt="${item.name}" />
            <div class="inventory-cell-actions">
              <button
                class="${equipable ? "" : "blocked"}"
                data-item-id="${item.id}"
                title="${equipable ? `Equip ${item.name}` : `Need level ${item.requiredLevel}`}"
              >${equipable ? "E" : `Lv${item.requiredLevel}`}</button>
              <button
                class="discard"
                data-discard-item-id="${item.id}"
                title="Discard ${item.name}"
              >D</button>
            </div>
            ${equipable ? "" : `<small class="equip-lock-hint">Need Lv${item.requiredLevel}</small>`}
          </div>
        `;
      })
      .join("");

    this.inventoryEl.innerHTML = `
      <h2>Inventory</h2>
      <div class="equipment-grid">${equipmentGrid}</div>
      <div class="inventory-subhead">Backpack (${player.inventory.length})</div>
      <div class="inventory-scroll">
        <div class="inventory-grid">${inventoryGrid || '<div class="inventory-empty">No drops yet.</div>'}</div>
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
      <h2>System Log</h2>
      <div class="log-list">
        ${rows || '<p class="log-empty">No events yet.</p>'}
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
      const name = escapeHtml(element.dataset.tooltipName ?? "Consumable");
      const descriptionRaw = element.dataset.tooltipDescription ?? "";
      const hotkey = escapeHtml(element.dataset.tooltipHotkey ?? "-");
      const charges = parseTooltipNumber(element.dataset.tooltipCharges);
      const cooldownLeftMs = parseTooltipNumber(element.dataset.tooltipCooldownLeftMs);
      const status = formatCooldownLabel(cooldownLeftMs);
      const disabledReasonRaw = element.dataset.tooltipDisabledReason;
      this.showTooltipHtml(
        `
          <div class="tooltip-name">${name}</div>
          <div class="tooltip-meta">Hotkey: ${hotkey}</div>
          ${
            descriptionRaw.length > 0
              ? `<div class="tooltip-body">${escapeHtml(descriptionRaw)}</div>`
              : ""
          }
          <div class="tooltip-divider"></div>
          <div class="tooltip-meta">Charges: ${charges}</div>
          <div class="tooltip-meta">Status: ${escapeHtml(status)}</div>
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
      const name = escapeHtml(element.dataset.tooltipName ?? "Skill");
      const descriptionRaw = element.dataset.tooltipDescription ?? "";
      const hotkey = escapeHtml(element.dataset.tooltipHotkey ?? "-");
      const cooldownLeftMs = parseTooltipNumber(element.dataset.tooltipCooldownLeftMs);
      const baseCooldownMs = parseTooltipNumber(element.dataset.tooltipBaseCooldownMs);
      const manaCost = parseTooltipNumber(element.dataset.tooltipManaCost);
      const targeting = element.dataset.tooltipTargeting ?? "";
      const range = parseTooltipNumber(element.dataset.tooltipRange);
      const locked = element.dataset.tooltipLocked === "1";
      const outOfMana = element.dataset.tooltipOutOfMana === "1";
      const status = locked ? "Locked" : formatCooldownLabel(cooldownLeftMs);
      const targetingLabel = formatTargetingLabel(targeting, range);
      this.showTooltipHtml(
        `
          <div class="tooltip-name">${name}</div>
          <div class="tooltip-meta">Hotkey: ${hotkey}</div>
          ${
            descriptionRaw.length > 0
              ? `<div class="tooltip-body">${escapeHtml(descriptionRaw)}</div>`
              : ""
          }
          <div class="tooltip-divider"></div>
          <div class="tooltip-meta">Status: ${escapeHtml(status)}</div>
          ${locked ? "" : `<div class="tooltip-meta">Mana Cost: ${manaCost}</div>`}
          ${locked || baseCooldownMs <= 0 ? "" : `<div class="tooltip-meta">Base CD: ${(baseCooldownMs / 1000).toFixed(1)}s</div>`}
          ${locked ? "" : `<div class="tooltip-meta">Target: ${escapeHtml(targetingLabel)}</div>`}
          ${!locked && outOfMana ? '<div class="tooltip-warning">Not enough mana.</div>' : ""}
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
    const itemAffixes = collectItemAffixMap(item);
    const compareAffixes = compareItem === undefined ? new Map<string, number>() : collectItemAffixMap(compareItem);
    const keys = new Set<string>([...itemAffixes.keys(), ...compareAffixes.keys()]);
    const affixLines = [...keys]
      .sort((left, right) => left.localeCompare(right))
      .map((key) => {
        const itemValue = itemAffixes.get(key) ?? 0;
        const compareValue = compareAffixes.get(key) ?? 0;
        const delta = itemValue - compareValue;
        const deltaClass = delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-equal";
        return `
          <div class="tooltip-affix-line">
            <span>${escapeHtml(formatAffixName(key))}</span>
            <span class="tooltip-affix-value ${deltaClass}">${escapeHtml(
              formatAffixValue(key, itemValue)
            )}${compareItem === undefined ? "" : ` (${escapeHtml(formatSignedValue(delta))})`}</span>
          </div>
        `;
      })
      .join("");
    const itemPowerScore = calculateItemPowerScore(item);
    const comparePowerScore = compareItem === undefined ? 0 : calculateItemPowerScore(compareItem);
    const powerDelta = itemPowerScore - comparePowerScore;
    const powerDeltaClass = powerDelta > 0 ? "delta-up" : powerDelta < 0 ? "delta-down" : "delta-equal";

    this.showTooltipHtml(
      `
      <div class="tooltip-name">${escapeHtml(item.name)}</div>
      <div class="tooltip-rarity ${item.rarity}">${item.rarity.toUpperCase()}</div>
      <div class="tooltip-meta">Slot: ${slotLongLabel(item.slot)}${item.weaponType === undefined ? "" : ` · ${escapeHtml(item.weaponType.toUpperCase())}`}</div>
      <div class="tooltip-meta">Req Lvl: ${item.requiredLevel}</div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-affixes">${affixLines || "No affixes"}</div>
      ${
        compareItem === undefined
          ? ""
          : `
            <div class="tooltip-divider"></div>
            <div class="tooltip-compare-head">Compare: ${escapeHtml(compareItem.name)}</div>
            <div class="tooltip-compare-score ${powerDeltaClass}">
              Power Δ ${escapeHtml(formatSignedValue(powerDelta))}
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

  showSummary(summary: RunSummary): void {
    this.summaryEl.className = "run-summary-overlay";
    this.summaryEl.innerHTML = renderRunSummaryScreen(summary);
    bindRunSummaryActions(this.summaryEl, () => this.onNewRun());
    document.addEventListener("keydown", this.onSummaryContinueKeydown);
  }

  clearSummary(): void {
    this.summaryEl.className = "hidden";
    this.summaryEl.innerHTML = "";
    document.removeEventListener("keydown", this.onSummaryContinueKeydown);
    this.hideEventPanel();
  }

  reset(): void {
    this.clearSummary();
    this.hideDeathOverlay();
    this.hideEventPanel();
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
