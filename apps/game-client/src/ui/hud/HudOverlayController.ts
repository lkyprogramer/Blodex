import type {
  ItemInstance,
  MerchantOffer,
  RandomEventDef,
  RunSummary
} from "@blodex/core";
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
import { bindRunSummaryActions, renderRunSummaryScreen } from "../components/RunSummaryScreen";
import type { RunOutcomeAnalysis } from "../../scenes/dungeon/taste/RunOutcomeAnalyzer";
import { getContentLocalizer, t } from "../../i18n";
import {
  buildEquipmentCompareView,
  summaryDirectionSymbol,
  summaryKeyLabelKey
} from "./compare/EquipmentCompareViewPresenter";
import type { EquipmentDeltaSummaryKey } from "./compare/EquipmentDeltaPresenter";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAffixNameFallback(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

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

function directionToPromptTone(direction: "up" | "down" | "equal"): "positive" | "negative" | "neutral" {
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

export class HudOverlayController {
  private readonly contentLocalizer = getContentLocalizer();
  private heartbeatToastTimeoutId: number | null = null;
  private readonly onSummaryContinueKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    this.onNewRun();
  };

  constructor(
    private readonly summaryEl: HTMLDivElement,
    private readonly eventPanelEl: HTMLDivElement,
    private readonly heartbeatToastEl: HTMLDivElement,
    private readonly equipmentCompareEl: HTMLDivElement,
    private readonly onEquip: (itemId: string) => void,
    private readonly onNewRun: () => void
  ) {}

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
    this.hideEventPanel();
    this.hideHeartbeatToast();
    this.hideEquipmentComparePrompt();
  }
}
