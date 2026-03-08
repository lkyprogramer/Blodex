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
import {
  detectPreferredImageFormat,
  type PreferredImageFormat
} from "../../assets/imageAsset";
import {
  type EventChoiceView
} from "../components/EventDialog";
import {
  bindConsumableBarActions,
  renderSkillBar
} from "../components/SkillBar";
import type { HeartbeatToastView } from "../components/HeartbeatToast";
import type { RunOutcomeAnalysis } from "../../scenes/dungeon/taste/RunOutcomeAnalyzer";
import { t } from "../../i18n";
import { renderHudLogPanel } from "./HudLogPresenter";
import { buildHudPanelRenderOutput } from "./HudPanelRender";
import { buildQuickbarTooltipHtml } from "./HudQuickbarTooltipPresenter";
import type { HudStatHighlight } from "./compare/StatDeltaHighlighter";
import { HudOverlayController } from "./HudOverlayController";
import { HudInventoryController } from "./HudInventoryController";

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

const MAX_LOG_ENTRIES = 200;
function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  private readonly deathOverlayEl = document.querySelector("#death-overlay") as HTMLDivElement;
  private logEntries: LogEntry[] = [];
  private nextLogId = 1;
  private readonly preferredImageFormat: PreferredImageFormat;
  private readonly overlayController: HudOverlayController;
  private readonly inventoryController: HudInventoryController;

  constructor(
    private readonly onEquip: (itemId: string) => void,
    private readonly onUnequip: (slot: EquipmentSlot) => void,
    private readonly onDiscard: (itemId: string) => void,
    private readonly onUseConsumable: (consumableId: ConsumableId) => void,
    private readonly onNewRun: () => void
  ) {
    this.preferredImageFormat = detectPreferredImageFormat();
    this.overlayController = new HudOverlayController(
      document.querySelector("#run-summary-overlay") as HTMLDivElement,
      document.querySelector("#event-panel") as HTMLDivElement,
      document.querySelector("#heartbeat-toast-layer") as HTMLDivElement,
      document.querySelector("#equipment-compare-overlay") as HTMLDivElement,
      this.onEquip,
      this.onNewRun
    );
    this.inventoryController = new HudInventoryController(
      this.inventoryEl,
      this.onEquip,
      this.onUnequip,
      this.onDiscard
    );
    this.bossBarEl.className = "hidden";
    this.skillBarEl.className = "hidden";
    this.renderLogPanel();
    this.hideDeathOverlay();
    this.hideEventPanel();
    this.hideHeartbeatToast();
    this.hideEquipmentComparePrompt();
  }

  render(state: HudState): void {
    const panels = buildHudPanelRenderOutput(state);
    this.metaEl.className = "panel-block compact-block";
    this.metaEl.innerHTML = panels.metaHtml;
    this.hudCriticalEl?.classList.toggle("low-health-critical", panels.lowHealth);
    document.body.classList.toggle("low-health-critical", panels.lowHealth);
    this.statsEl.className = "panel-block compact-block";
    this.statsEl.innerHTML = panels.statsHtml;

    this.runEl.className = "panel-block compact-block";
    this.runEl.innerHTML = panels.runHtml;

    if (panels.bossBarHtml.length === 0) {
      this.bossBarEl.className = "hidden";
      this.bossBarEl.innerHTML = "";
    } else {
      this.bossBarEl.className = "";
      this.bossBarEl.innerHTML = panels.bossBarHtml;
    }

    const hasSkillbarContent =
      (state.run.consumables?.length ?? 0) > 0 || (state.run.skillSlots?.length ?? 0) > 0;
    if (!hasSkillbarContent) {
      this.skillBarEl.className = "hidden";
      this.skillBarEl.innerHTML = "";
      this.inventoryController.hideTooltip();
    } else {
      this.skillBarEl.className = "skillbar-root";
      this.skillBarEl.innerHTML = renderSkillBar(
        {
          ...(state.run.consumables === undefined ? {} : { consumables: state.run.consumables }),
          ...(state.run.skillSlots === undefined ? {} : { skillSlots: state.run.skillSlots })
        },
        this.preferredImageFormat
      );
      this.inventoryController.bindGeneratedImageFallbacks(this.skillBarEl);
      bindConsumableBarActions(this.skillBarEl, this.onUseConsumable);
      this.bindQuickbarTooltips();
    }

    this.inventoryController.renderInventory(state.player, state.run.newlyAcquiredItemIds ?? []);
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

  private renderLogPanel(): void {
    this.logEl.className = "panel-block log-panel";
    this.logEl.innerHTML = renderHudLogPanel(this.logEntries);
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
        this.inventoryController.hideTooltip();
      });
    });
  }

  private showQuickbarTooltip(element: HTMLElement, event: MouseEvent): void {
    const contentHtml = buildQuickbarTooltipHtml(element);
    if (contentHtml === null) {
      return;
    }
    this.inventoryController.showTooltipHtml(contentHtml, event);
  }

  showHeartbeatToast(view: HeartbeatToastView): void {
    this.overlayController.showHeartbeatToast(view);
  }

  hideHeartbeatToast(): void {
    this.overlayController.hideHeartbeatToast();
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
    this.overlayController.showEquipmentComparePrompt(item, compareItem, options);
  }

  hideEquipmentComparePrompt(): void {
    this.overlayController.hideEquipmentComparePrompt();
  }

  showEventPanel(
    eventDef: RandomEventDef,
    choices: EventChoiceView[],
    onChoose: (choiceId: string) => void,
    onClose: () => void
  ): void {
    this.overlayController.showEventPanel(eventDef, choices, onChoose, onClose);
  }

  showMerchantPanel(
    offers: Array<MerchantOffer & { itemName: string; rarity: string }>,
    onBuy: (offerId: string) => void,
    onClose: () => void
  ): void {
    this.overlayController.showMerchantPanel(offers, onBuy, onClose);
  }

  hideEventPanel(): void {
    this.overlayController.hideEventPanel();
  }

  showSummary(summary: RunSummary, analysis?: RunOutcomeAnalysis): void {
    this.overlayController.showSummary(summary, analysis);
  }

  clearSummary(): void {
    this.overlayController.clearSummary();
  }

  reset(): void {
    this.overlayController.reset();
    this.hideDeathOverlay();
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
    this.inventoryController.reset();
    this.logEl.className = "hidden";
    this.logEl.innerHTML = "";
    this.hudCriticalEl?.classList.remove("low-health-critical");
    document.body.classList.remove("low-health-critical");
  }
}
