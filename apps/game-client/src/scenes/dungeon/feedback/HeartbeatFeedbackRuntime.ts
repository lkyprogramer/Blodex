import type { GameEventMap, ItemInstance, TypedEventBus } from "@blodex/core";
import { t } from "../../../i18n";
import type { FeedbackRouterInput } from "../../../systems/feedbackEventRouter";
import type { HeartbeatToastView } from "../../../ui/components/HeartbeatToast";
import { isMerchantHighValueCompareCandidate } from "../../../ui/hud/compare/EquipmentCompareViewPresenter";

type ComparePromptSource =
  | "auto_pickup"
  | "merchant_purchase"
  | "event_reward"
  | "boss_reward"
  | "challenge_reward"
  | "hidden_room_reward"
  | "pair_fallback";

interface HeartbeatContentLocalizer {
  itemName(itemDefId: string, fallback: string): string;
}

interface HeartbeatUiPort {
  showHeartbeatToast(view: HeartbeatToastView): void;
  hideHeartbeatToast(): void;
  showEquipmentComparePrompt(
    item: ItemInstance,
    compareItem: ItemInstance | undefined,
    options: {
      title: string;
      subtitle: string;
      sourceLabel: string;
      onAction: (action: "equip" | "later" | "ignore") => void;
    }
  ): void;
  hideEquipmentComparePrompt(): void;
}

export interface HeartbeatFeedbackRuntimeHost {
  eventBus: TypedEventBus<GameEventMap>;
  uiManager: HeartbeatUiPort;
  contentLocalizer: HeartbeatContentLocalizer;
  player: {
    equipment: Record<string, ItemInstance | undefined>;
  };
  routeFeedback(input: FeedbackRouterInput): void;
  eventPanelOpen: boolean;
  comparePromptOpen: boolean;
  hudDirty: boolean;
}

interface QueuedComparePrompt {
  item: ItemInstance;
  source: ComparePromptSource;
}

const TOAST_THROTTLE_MS = {
  rare: 1_400,
  buildFamily: 2_200,
  boss: 1_800,
  spike: 1_600,
  pressure: 2_000
} as const;

const SOURCE_LABEL_KEYS: Record<ComparePromptSource, string> = {
  auto_pickup: "ui.feedback.compare.source.auto_pickup",
  merchant_purchase: "ui.feedback.compare.source.merchant_purchase",
  event_reward: "ui.feedback.compare.source.event_reward",
  boss_reward: "ui.feedback.compare.source.boss_reward",
  challenge_reward: "ui.feedback.compare.source.challenge_reward",
  hidden_room_reward: "ui.feedback.compare.source.hidden_room_reward",
  pair_fallback: "ui.feedback.compare.source.pair_fallback"
};

const BUILD_TAG_LABEL_KEYS: Record<string, string> = {
  "build:offense": "ui.feedback.build_tag.offense",
  "build:defense": "ui.feedback.build_tag.defense",
  "build:utility": "ui.feedback.build_tag.utility",
  "build:branching": "ui.feedback.build_tag.branching",
  "kill:boss": "ui.feedback.build_tag.kill_boss",
  "kill:elite": "ui.feedback.build_tag.kill_elite",
  "stat:strength": "ui.feedback.build_tag.strength",
  "stat:dexterity": "ui.feedback.build_tag.dexterity",
  "stat:vitality": "ui.feedback.build_tag.vitality",
  "stat:intelligence": "ui.feedback.build_tag.intelligence"
};

const SYNERGY_COPY_KEYS: Record<string, { title: string; detail: string }> = {
  syn_staff_chain_lightning_overload: {
    title: "ui.feedback.synergy.syn_staff_chain_lightning_overload.title",
    detail: "ui.feedback.synergy.syn_staff_chain_lightning_overload.detail"
  },
  syn_dagger_shadow_step_ambush: {
    title: "ui.feedback.synergy.syn_dagger_shadow_step_ambush.title",
    detail: "ui.feedback.synergy.syn_dagger_shadow_step_ambush.detail"
  },
  syn_frost_spirit_resonance: {
    title: "ui.feedback.synergy.syn_frost_spirit_resonance.title",
    detail: "ui.feedback.synergy.syn_frost_spirit_resonance.detail"
  },
  syn_quake_hammer_shock: {
    title: "ui.feedback.synergy.syn_quake_hammer_shock.title",
    detail: "ui.feedback.synergy.syn_quake_hammer_shock.detail"
  },
  syn_keen_berserk_velocity: {
    title: "ui.feedback.synergy.syn_keen_berserk_velocity.title",
    detail: "ui.feedback.synergy.syn_keen_berserk_velocity.detail"
  },
  syn_cdr_chain_window: {
    title: "ui.feedback.synergy.syn_cdr_chain_window.title",
    detail: "ui.feedback.synergy.syn_cdr_chain_window.detail"
  }
};

export class HeartbeatFeedbackRuntime {
  private readonly lastToastAtByKey = new Map<string, number>();
  private readonly compareQueue: QueuedComparePrompt[] = [];
  private readonly deferredCompareQueue: QueuedComparePrompt[] = [];
  private readonly immediateDrainCallbacks: Array<() => void> = [];
  private compareDrainMode: "all" | "immediate" = "all";

  constructor(private readonly host: HeartbeatFeedbackRuntimeHost) {}

  bind(): void {
    this.host.eventBus.on("build_formed", ({ tags, timestampMs, source }) => {
      this.showBuildToast(tags, source, timestampMs);
    });
    this.host.eventBus.on("rare_drop_presented", ({ itemDefId, rarity, timestampMs }) => {
      this.showRareDropToast(itemDefId, rarity, timestampMs);
    });
    this.host.eventBus.on("boss_reward_closed", ({ choiceId, timestampMs }) => {
      this.showBossRewardToast(choiceId, timestampMs);
    });
    this.host.eventBus.on("synergy_activated", ({ synergyId, timestampMs }) => {
      this.showSynergyToast(synergyId, timestampMs);
    });
    this.host.eventBus.on("power_spike", ({ sourceKind, major, timestampMs }) => {
      if (sourceKind === "drop_spawn" || sourceKind === "boss_reward" || sourceKind === "build_threshold") {
        return;
      }
      this.showPowerSpikeToast(major === true, timestampMs);
    });
    this.host.eventBus.on("pressure_peak", ({ kind, label, timestampMs }) => {
      this.showPressurePeakToast(kind, label, timestampMs);
    });
  }

  reset(): void {
    this.lastToastAtByKey.clear();
    this.compareQueue.length = 0;
    this.deferredCompareQueue.length = 0;
    this.immediateDrainCallbacks.length = 0;
    this.compareDrainMode = "all";
    this.host.comparePromptOpen = false;
    this.host.uiManager.hideHeartbeatToast();
    this.host.uiManager.hideEquipmentComparePrompt();
  }

  maybeQueueEquipmentCompare(item: ItemInstance, source: ComparePromptSource): void {
    if (!this.shouldPromptForItem(item, source)) {
      return;
    }
    if (this.isQueued(item.id)) {
      return;
    }
    this.compareQueue.push({ item, source });
    if (this.host.eventPanelOpen) {
      return;
    }
    this.compareDrainMode = "all";
    this.drainCompareQueue();
  }

  flushImmediateComparePrompts(onDrained?: () => void): boolean {
    if (onDrained !== undefined) {
      this.immediateDrainCallbacks.push(onDrained);
    }
    this.compareDrainMode = "immediate";
    if (this.host.eventPanelOpen || this.host.comparePromptOpen) {
      return false;
    }
    this.drainCompareQueue(false);
    return this.host.comparePromptOpen;
  }

  private drainCompareQueue(allowDeferred = this.compareDrainMode === "all"): void {
    if (this.host.comparePromptOpen || this.host.eventPanelOpen) {
      return;
    }
    const next = this.compareQueue.shift() ?? (allowDeferred ? this.deferredCompareQueue.shift() : undefined);
    if (next === undefined) {
      this.finishImmediateDrainIfIdle();
      return;
    }
    const compareItem = this.host.player.equipment[next.item.slot];
    this.host.comparePromptOpen = true;
    this.host.routeFeedback({
      type: "equipment:compare"
    });
    this.host.uiManager.showEquipmentComparePrompt(next.item, compareItem, {
      title: t("ui.feedback.compare.title"),
      subtitle: t("ui.feedback.compare.subtitle"),
      sourceLabel: t(SOURCE_LABEL_KEYS[next.source]),
      onAction: (action) => {
        this.host.comparePromptOpen = false;
        this.host.hudDirty = true;
        if (action === "later") {
          this.deferredCompareQueue.push(next);
          if (this.compareQueue.length > 0) {
            this.drainCompareQueue(false);
            return;
          }
          this.finishImmediateDrainIfIdle();
          return;
        }
        this.drainCompareQueue();
      }
    });
  }

  private shouldPromptForItem(item: ItemInstance, source: ComparePromptSource): boolean {
    if (item.kind !== "equipment" && item.kind !== "unique") {
      return false;
    }
    if (item.rarity === "rare" || item.kind === "unique") {
      return true;
    }
    if (source !== "merchant_purchase") {
      return false;
    }
    return isMerchantHighValueCompareCandidate(item, this.host.player.equipment[item.slot]);
  }

  private isQueued(itemId: string): boolean {
    return (
      this.compareQueue.some((entry) => entry.item.id === itemId) ||
      this.deferredCompareQueue.some((entry) => entry.item.id === itemId)
    );
  }

  private finishImmediateDrainIfIdle(): void {
    if (this.compareDrainMode !== "immediate") {
      return;
    }
    this.compareDrainMode = "all";
    const callbacks = this.immediateDrainCallbacks.splice(0);
    for (const callback of callbacks) {
      callback();
    }
  }

  private showRareDropToast(itemDefId: string, rarity: "rare" | "unique", nowMs: number): void {
    if (!this.allowToast("rare_drop", nowMs, TOAST_THROTTLE_MS.rare)) {
      return;
    }
    this.host.uiManager.showHeartbeatToast({
      title: rarity === "rare" ? t("ui.feedback.toast.rare_drop.title") : t("ui.feedback.toast.unique_drop.title"),
      detail: this.host.contentLocalizer.itemName(itemDefId, itemDefId),
      tone: "rare"
    });
  }

  private showBuildToast(tags: string[], source: string, nowMs: number): void {
    if (!this.allowToast("build_family", nowMs, TOAST_THROTTLE_MS.buildFamily)) {
      return;
    }
    const detail = tags
      .map((tag) => {
        const key = BUILD_TAG_LABEL_KEYS[tag];
        return key === undefined ? tag : t(key);
      })
      .slice(0, 3)
      .join(" · ");
    this.host.uiManager.showHeartbeatToast({
      title: t("ui.feedback.toast.build_formed.title"),
      detail: detail.length > 0 ? detail : source,
      tone: "build"
    });
  }

  private showBossRewardToast(_choiceId: string, nowMs: number): void {
    if (!this.allowToast("boss_reward", nowMs, TOAST_THROTTLE_MS.boss)) {
      return;
    }
    this.host.uiManager.showHeartbeatToast({
      title: t("ui.feedback.toast.boss_reward.title"),
      detail: t("ui.feedback.toast.boss_reward.detail"),
      tone: "boss"
    });
  }

  private showSynergyToast(synergyId: string, nowMs: number): void {
    if (!this.allowToast("build_family", nowMs, TOAST_THROTTLE_MS.buildFamily)) {
      return;
    }
    const copy = SYNERGY_COPY_KEYS[synergyId];
    this.host.uiManager.showHeartbeatToast({
      title: copy?.title === undefined ? t("ui.feedback.toast.synergy_activated.title") : t(copy.title),
      detail: copy?.detail === undefined ? synergyId : t(copy.detail),
      tone: "synergy"
    });
  }

  private showPowerSpikeToast(major: boolean, nowMs: number): void {
    if (!major && !this.allowToast("power_spike", nowMs, TOAST_THROTTLE_MS.spike)) {
      return;
    }
    if (major && !this.allowToast("major_power_spike", nowMs, TOAST_THROTTLE_MS.spike)) {
      return;
    }
    this.host.uiManager.showHeartbeatToast({
      title: major ? t("ui.feedback.toast.major_power_spike.title") : t("ui.feedback.toast.power_spike.title"),
      detail: major ? t("ui.feedback.toast.major_power_spike.detail") : t("ui.feedback.toast.power_spike.detail"),
      tone: "spike"
    });
  }

  private showPressurePeakToast(
    kind: "elite_kill" | "near_death_reversal",
    label: string | undefined,
    nowMs: number
  ): void {
    if (!this.allowToast(`pressure:${kind}`, nowMs, TOAST_THROTTLE_MS.pressure)) {
      return;
    }
    this.host.routeFeedback({
      type: "power_spike",
      major: kind === "near_death_reversal"
    });
    this.host.uiManager.showHeartbeatToast({
      title:
        kind === "elite_kill"
          ? t("ui.feedback.toast.elite_kill.title")
          : t("ui.feedback.toast.near_death_reversal.title"),
      detail:
        kind === "elite_kill"
          ? label === undefined
            ? t("ui.feedback.toast.elite_kill.detail")
            : t("ui.feedback.toast.elite_kill.detail_named", { enemy: label })
          : t("ui.feedback.toast.near_death_reversal.detail"),
      tone: "spike"
    });
  }

  private allowToast(key: string, nowMs: number, cooldownMs: number): boolean {
    const last = this.lastToastAtByKey.get(key) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - last < cooldownMs) {
      return false;
    }
    this.lastToastAtByKey.set(key, nowMs);
    return true;
  }
}
