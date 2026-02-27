import type {
  ConsumableId,
  EquipmentSlot,
  EventChoice,
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

interface HudState {
  player: PlayerState;
  run: {
    floor: number;
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
      hotkey: string;
      charges: number;
      cooldownLeftMs: number;
      disabledReason?: string;
    }>;
  };
  meta: MetaProgression;
}

interface EventChoiceView {
  choice: EventChoice;
  enabled: boolean;
  disabledReason?: string;
}

type LogLevel = "info" | "success" | "warn" | "danger";

interface LogEntry {
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

export class Hud {
  private readonly metaEl = document.querySelector("#meta") as HTMLDivElement;
  private readonly statsEl = document.querySelector("#stats") as HTMLDivElement;
  private readonly runEl = document.querySelector("#run") as HTMLDivElement;
  private readonly inventoryEl = document.querySelector("#inventory") as HTMLDivElement;
  private readonly logEl = document.querySelector("#log") as HTMLDivElement;
  private readonly summaryEl = document.querySelector("#summary") as HTMLDivElement;
  private readonly deathOverlayEl = document.querySelector("#death-overlay") as HTMLDivElement;
  private readonly eventPanelEl = document.querySelector("#event-panel") as HTMLDivElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly preferredImageFormat = detectPreferredImageFormat();

  private logEntries: LogEntry[] = [];
  private nextLogId = 1;

  constructor(
    private readonly onEquip: (itemId: string) => void,
    private readonly onUnequip: (slot: EquipmentSlot) => void,
    private readonly onUseConsumable: (consumableId: ConsumableId) => void,
    private readonly onNewRun: () => void
  ) {
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "inventory-tooltip hidden";
    document.body.appendChild(this.tooltipEl);
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
    this.statsEl.className = "panel-block compact-block";
    this.statsEl.innerHTML = `
      <h2>Vanguard</h2>
      <div class="mini-grid mini-2">
        <div><span class="k">Lvl</span><span>${player.level}</span></div>
        <div><span class="k">XP</span><span>${player.xp}/${player.xpToNextLevel}</span></div>
        <div><span class="k">HP</span><span>${Math.floor(player.health)}/${Math.floor(player.derivedStats.maxHealth)}</span></div>
        <div><span class="k">Mana</span><span>${Math.floor(player.mana)}/${Math.floor(player.derivedStats.maxMana)}</span></div>
        <div><span class="k">Pow</span><span>${Math.floor(player.derivedStats.attackPower)}</span></div>
        <div><span class="k">Arm</span><span>${Math.floor(player.derivedStats.armor)}</span></div>
      </div>
    `;

    this.runEl.className = "panel-block compact-block";
    const skillsHtml =
      player.skills === undefined
        ? ""
        : `<div class=\"skill-bar\">${player.skills.skillSlots
            .map((slot, index) => {
              if (slot === null) {
                return `<div class=\"skill-slot locked\"><span class=\"skill-key\">${index + 1}</span><span>Locked</span></div>`;
              }
              const readyAt = player.skills?.cooldowns[slot.defId] ?? 0;
              const remainingMs = Math.max(0, readyAt - performance.now());
              const remainingText = remainingMs > 0 ? `${(remainingMs / 1000).toFixed(1)}s` : "Ready";
              const manaEnough = player.mana >= 1;
              return `<div class=\"skill-slot ${remainingMs > 0 ? "cooldown" : "ready"} ${
                manaEnough ? "" : "oom"
              }\"><span class=\"skill-key\">${index + 1}</span><span>${slot.defId}</span><small>${remainingText}</small></div>`;
            })
            .join("")}</div>`;
    const consumablesHtml = (state.run.consumables ?? [])
      .map((entry) => {
        const disabled = entry.disabledReason !== undefined;
        const cooldown = entry.cooldownLeftMs > 0 ? `${(entry.cooldownLeftMs / 1000).toFixed(1)}s` : "Ready";
        return `
          <button
            class="consumable-slot ${disabled ? "disabled" : "ready"}"
            data-consumable-id="${entry.id}"
            ${disabled ? "disabled" : ""}
            title="${escapeHtml(entry.disabledReason ?? `Use ${entry.name}`)}"
          >
            <span class="consumable-key">${entry.hotkey}</span>
            <span class="consumable-name">${entry.name}</span>
            <small>${entry.charges} left · ${cooldown}</small>
          </button>
        `;
      })
      .join("");
    this.runEl.innerHTML = `
      <div class="mini-grid mini-2">
        <div><span class="k">Floor</span><span>${state.run.floor}</span></div>
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
      ${state.run.isBossFloor ? `<div class=\"boss-strip\">Boss HP: ${Math.max(
        0,
        Math.floor(state.run.bossHealth ?? 0)
      )}/${Math.max(1, Math.floor(state.run.bossMaxHealth ?? 1))} · Phase ${(state.run.bossPhase ?? 0) + 1}</div>` : ""}
      ${consumablesHtml.length > 0 ? `<div class="consumable-bar">${consumablesHtml}</div>` : ""}
      ${skillsHtml}
    `;

    this.runEl.querySelectorAll<HTMLButtonElement>("button[data-consumable-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.consumableId as ConsumableId | undefined;
        if (id !== undefined) {
          this.onUseConsumable(id);
        }
      });
    });

    this.renderInventory(player);
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

  showDeathOverlay(reason: string): void {
    this.deathOverlayEl.classList.remove("hidden");
    this.deathOverlayEl.innerHTML = `
      <div class="death-card">
        <h2>You Died</h2>
        <p>${escapeHtml(reason)}</p>
      </div>
    `;
  }

  hideDeathOverlay(): void {
    this.deathOverlayEl.classList.add("hidden");
    this.deathOverlayEl.innerHTML = "";
  }

  private renderInventory(player: PlayerState): void {
    const itemById = new Map<string, ItemInstance>();
    for (const item of player.inventory) {
      itemById.set(item.id, item);
    }
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
        return `
          <div class="inventory-cell ${item.rarity} ${equipable ? "" : "locked"}" data-item-id="${item.id}">
            <img class="item-icon" data-asset-id="${item.iconId}" src="${resolveGeneratedAssetUrl(
              item.iconId,
              this.preferredImageFormat
            )}" alt="${item.name}" />
            <button
              class="${equipable ? "" : "blocked"}"
              data-item-id="${item.id}"
              title="${equipable ? `Equip ${item.name}` : `Need level ${item.requiredLevel}`}"
            >${equipable ? "E" : `Lv${item.requiredLevel}`}</button>
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
    this.bindGeneratedImageFallbacks();

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
        this.showTooltip(item, event as MouseEvent);
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
        this.showTooltip(item, event as MouseEvent);
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

  private bindGeneratedImageFallbacks(): void {
    this.inventoryEl.querySelectorAll<HTMLImageElement>("img.item-icon[data-asset-id]").forEach((image) => {
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

  private showTooltip(item: ItemInstance, event: MouseEvent): void {
    const affixes = Object.entries(item.rolledAffixes)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `<div>+${value} ${formatAffixName(key)}</div>`)
      .join("");

    this.tooltipEl.innerHTML = `
      <div class="tooltip-name">${item.name}</div>
      <div class="tooltip-rarity ${item.rarity}">${item.rarity.toUpperCase()}</div>
      <div class="tooltip-meta">Slot: ${slotLongLabel(item.slot)}</div>
      <div class="tooltip-meta">Req Lvl: ${item.requiredLevel}</div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-affixes">${affixes || "No affixes"}</div>
    `;

    this.tooltipEl.classList.remove("hidden");
    const x = event.clientX + 14;
    const y = event.clientY + 14;
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
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
    const buttons = choices
      .map(({ choice, enabled, disabledReason }) => {
        return `
          <button
            class="event-choice ${enabled ? "" : "disabled"}"
            data-choice-id="${choice.id}"
            ${enabled ? "" : "disabled"}
            title="${escapeHtml(disabledReason ?? choice.description)}"
          >
            <span class="event-choice-name">${escapeHtml(choice.name)}</span>
            <small>${escapeHtml(choice.description)}</small>
          </button>
        `;
      })
      .join("");

    this.eventPanelEl.innerHTML = `
      <div class="event-card">
        <h2>${escapeHtml(eventDef.name)}</h2>
        <p>${escapeHtml(eventDef.description)}</p>
        <div class="event-choice-list">${buttons}</div>
        <button class="event-close" data-event-close="1">Close</button>
      </div>
    `;

    this.eventPanelEl.querySelectorAll<HTMLButtonElement>("button[data-choice-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const choiceId = button.dataset.choiceId;
        if (choiceId !== undefined) {
          onChoose(choiceId);
        }
      });
    });
    this.eventPanelEl.querySelector<HTMLButtonElement>("button[data-event-close='1']")?.addEventListener("click", onClose);
  }

  showMerchantPanel(
    offers: Array<MerchantOffer & { itemName: string; rarity: string }>,
    onBuy: (offerId: string) => void,
    onClose: () => void
  ): void {
    this.eventPanelEl.className = "event-panel";
    const rows = offers
      .map((offer) => {
        return `
          <div class="merchant-offer">
            <div>
              <div class="merchant-name">${escapeHtml(offer.itemName)}</div>
              <small class="merchant-rarity ${offer.rarity}">${offer.rarity.toUpperCase()}</small>
            </div>
            <button data-offer-id="${offer.offerId}">Buy (${offer.priceObol})</button>
          </div>
        `;
      })
      .join("");

    this.eventPanelEl.innerHTML = `
      <div class="event-card">
        <h2>Wandering Merchant</h2>
        <p>Spend Obol to buy items for this run.</p>
        <div class="merchant-list">${rows || '<p class="log-empty">Sold out.</p>'}</div>
        <button class="event-close" data-event-close="1">Leave</button>
      </div>
    `;

    this.eventPanelEl.querySelectorAll<HTMLButtonElement>("button[data-offer-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const offerId = button.dataset.offerId;
        if (offerId !== undefined) {
          onBuy(offerId);
        }
      });
    });
    this.eventPanelEl.querySelector<HTMLButtonElement>("button[data-event-close='1']")?.addEventListener("click", onClose);
  }

  hideEventPanel(): void {
    this.eventPanelEl.className = "hidden";
    this.eventPanelEl.innerHTML = "";
  }

  showSummary(summary: RunSummary): void {
    this.summaryEl.classList.remove("hidden");
    this.summaryEl.className = "panel-block";
    this.summaryEl.innerHTML = `
      <h2>${summary.isVictory ? "Run Victory" : "Run Ended"}</h2>
      <div class="stat-line"><span>Floor</span><span>${summary.floorReached}</span></div>
      <div class="stat-line"><span>Kills</span><span>${summary.kills}</span></div>
      <div class="stat-line"><span>Loot</span><span>${summary.lootCollected}</span></div>
      <div class="stat-line"><span>Obol</span><span>${summary.obolsEarned ?? 0}</span></div>
      <div class="stat-line"><span>Soul</span><span>${summary.soulShardsEarned ?? 0}</span></div>
      <div class="stat-line"><span>Time</span><span>${(summary.elapsedMs / 1000).toFixed(1)}s</span></div>
      <div class="stat-line"><span>Level</span><span>${summary.leveledTo}</span></div>
      <div class="summary-actions" style="margin-top: 10px;">
        <button id="new-run-button">Continue</button>
      </div>
    `;

    const button = this.summaryEl.querySelector("#new-run-button");
    button?.addEventListener("click", () => this.onNewRun());
  }

  clearSummary(): void {
    this.summaryEl.className = "hidden";
    this.summaryEl.innerHTML = "";
    this.hideEventPanel();
  }
}
