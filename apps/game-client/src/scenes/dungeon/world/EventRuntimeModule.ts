import Phaser from "phaser";
import { canPayEventCost, pickRandomEvent, rollEventRisk, type RandomEventDef, type RuntimeEventNodeState } from "@blodex/core";
import { RANDOM_EVENT_DEFS } from "@blodex/content";
import { t } from "../../../i18n";
import { EventResolutionService } from "./EventResolutionService";
import { MerchantFlowService } from "./MerchantFlowService";
import type { RuntimeEventHost } from "./types";

const FLOOR_EVENT_SPAWN_CHANCE = 0.62;

export interface EventRuntimeModuleOptions {
  host: RuntimeEventHost;
  resolutionService: EventResolutionService;
  merchantFlowService: MerchantFlowService;
}

export class EventRuntimeModule {
  constructor(private readonly options: EventRuntimeModuleOptions) {}

  setupFloorEvent(nowMs: number): void {
    const host = this.options.host;
    this.destroyEventNode();
    if (host.floorConfig.isBossFloor) {
      return;
    }
    if (host.eventRng.next() > FLOOR_EVENT_SPAWN_CHANCE) {
      return;
    }

    const eventDef = pickRandomEvent(
      RANDOM_EVENT_DEFS,
      host.run.currentFloor,
      host.currentBiome.id,
      host.unlockedEventIds,
      host.eventRng
    );
    if (eventDef === null) {
      return;
    }
    const position = this.pickFloorEventPosition();
    if (position === null) {
      return;
    }

    this.createEventNode(eventDef, position, nowMs);
  }

  createEventNode(
    eventDef: RandomEventDef,
    position: { x: number; y: number },
    nowMs: number,
    options?: { emitSpawnEvent?: boolean }
  ): void {
    const host = this.options.host;
    const marker = host.renderSystem.spawnTelegraphCircle(position, 0.8, host.origin);
    marker.setAlpha(0.18);
    if (marker instanceof Phaser.GameObjects.Image) {
      marker.setTint(0xd0a86f);
    }

    host.eventNode = {
      eventDef,
      position,
      marker,
      resolved: false
    };
    if (options?.emitSpawnEvent !== false) {
      const localizedEventName = host.contentLocalizer.eventName(eventDef.id, eventDef.name);
      host.eventBus.emit("event:spawn", {
        eventId: eventDef.id,
        eventName: localizedEventName,
        floor: host.run.currentFloor,
        timestampMs: nowMs
      });
    }
  }

  updateInteraction(nowMs: number): void {
    const host = this.options.host;
    if (host.eventNode === null || host.eventNode.resolved || host.eventPanelOpen) {
      return;
    }
    const distance = Math.hypot(
      host.player.position.x - host.eventNode.position.x,
      host.player.position.y - host.eventNode.position.y
    );
    if (distance > 0.9) {
      return;
    }
    this.openEventPanel(nowMs);
  }

  openEventPanel(nowMs: number): void {
    const host = this.options.host;
    if (host.eventNode === null || host.eventNode.resolved) {
      return;
    }

    host.eventPanelOpen = true;
    const eventDef: RandomEventDef = host.eventNode.eventDef;
    const choices = eventDef.choices.map((choice) => {
      if (canPayEventCost(choice.cost, host.player.health, host.player.mana, host.run.runEconomy.obols)) {
        return { choice, enabled: true as const };
      }
      const reason =
        choice.cost === undefined
          ? t("ui.event.choice.unavailable")
          : t("ui.event.choice.need_cost", {
              amount: choice.cost.amount,
              type: choice.cost.type
            });
      return { choice, enabled: false as const, disabledReason: reason };
    });

    host.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId: string) => this.resolveChoice(choiceId, host.time.now),
      () => this.dismissCurrentEvent(host.time.now)
    );
    host.runLog.appendKey(
      "log.event.encountered",
      {
        eventName: host.contentLocalizer.eventName(eventDef.id, eventDef.name)
      },
      "info",
      nowMs
    );
  }

  dismissCurrentEvent(nowMs: number): void {
    const host = this.options.host;
    if (host.eventNode === null) {
      return;
    }
    host.runLog.appendKey(
      "log.event.left_without_interaction",
      {
        eventName: host.contentLocalizer.eventName(host.eventNode.eventDef.id, host.eventNode.eventDef.name)
      },
      "info",
      nowMs
    );
    this.consumeCurrentEvent();
  }

  resolveChoice(choiceId: string, nowMs: number): void {
    const host = this.options.host;
    if (host.eventNode === null || host.eventNode.resolved) {
      return;
    }

    const eventDef: RandomEventDef = host.eventNode.eventDef;
    const choice = eventDef.choices.find((entry) => entry.id === choiceId);
    if (choice === undefined) {
      host.runLog.appendKey(
        "log.event.choice_not_found",
        {
          choiceId
        },
        "warn",
        nowMs
      );
      return;
    }

    if (!this.options.resolutionService.applyCost(nowMs, eventDef.id, choice.id)) {
      host.hudDirty = true;
      return;
    }

    host.eventBus.emit("event:choice", {
      eventId: eventDef.id,
      choiceId: choice.id,
      timestampMs: nowMs
    });

    const localizedEventName = host.contentLocalizer.eventName(eventDef.id, eventDef.name);
    const eventSource = t("log.event.source", { eventName: localizedEventName });
    for (const reward of choice.rewards) {
      this.options.resolutionService.applyReward(reward, nowMs, eventSource);
    }
    host.tryDiscoverBlueprints("random_event", nowMs, eventDef.id);

    if (rollEventRisk(choice, host.eventRng) && choice.risk !== undefined) {
      this.options.resolutionService.applyPenalty(
        choice.risk.penalty,
        nowMs,
        t("log.event.backlash_source", { eventName: localizedEventName })
      );
    }

    if (eventDef.id === "wandering_merchant" && choice.id === "browse") {
      this.openMerchantPanel(nowMs);
      host.hudDirty = true;
      return;
    }

    this.consumeCurrentEvent();
    host.hudDirty = true;
    host.flushRunSave();
    if (host.player.health <= 0) {
      host.runCompletionModule.finishRun(false);
    }
  }

  openMerchantPanel(nowMs: number): void {
    const host = this.options.host;
    if (!this.options.merchantFlowService.ensureOffers(nowMs)) {
      this.consumeCurrentEvent();
      return;
    }

    const view = this.options.merchantFlowService.buildView();
    host.eventPanelOpen = true;
    host.uiManager.showMerchantDialog(
      view,
      (offerId: string) => this.tryBuyMerchantOffer(offerId, host.time.now),
      () => this.consumeCurrentEvent()
    );
  }

  tryBuyMerchantOffer(offerId: string, nowMs: number): void {
    const host = this.options.host;
    const result = this.options.merchantFlowService.tryBuyOffer(offerId, nowMs);
    if (result.kind === "missing_offer" || result.kind === "insufficient_obol" || result.kind === "delivery_failed") {
      host.routeFeedback({
        type: "merchant:fail"
      });
      return;
    }

    if (result.kind === "sold_out") {
      this.consumeCurrentEvent();
    } else {
      this.openMerchantPanel(nowMs);
    }
    host.hudDirty = true;
  }

  consumeCurrentEvent(): void {
    const host = this.options.host;
    if (host.eventNode !== null) {
      host.eventNode.resolved = true;
    }
    this.destroyEventNode();
    host.uiManager.hideEventPanel();
    host.eventPanelOpen = false;
    host.hudDirty = true;
  }

  snapshot(): RuntimeEventNodeState | null {
    const host = this.options.host;
    if (host.eventNode === null) {
      return null;
    }
    return {
      eventId: host.eventNode.eventDef.id,
      position: { ...host.eventNode.position },
      resolved: host.eventNode.resolved,
      ...(host.merchantOffers.length === 0
        ? {}
        : { merchantOffers: host.merchantOffers.map((offer: Record<string, unknown>) => ({ ...offer })) })
    };
  }

  destroyEventNode(): void {
    const host = this.options.host;
    if (host.eventNode !== null) {
      host.eventNode.marker.destroy();
    }
    host.eventNode = null;
    host.merchantOffers = [];
    host.eventPanelOpen = false;
  }

  private pickFloorEventPosition(): { x: number; y: number } | null {
    const host = this.options.host;
    const candidates = host.dungeon.spawnPoints.filter((point: { x: number; y: number }) => {
      if (Math.hypot(point.x - host.player.position.x, point.y - host.player.position.y) < 6) {
        return false;
      }
      if (Math.hypot(point.x - host.staircaseState.position.x, point.y - host.staircaseState.position.y) < 2) {
        return false;
      }
      for (const hazard of host.hazards) {
        if (Math.hypot(point.x - hazard.position.x, point.y - hazard.position.y) < hazard.radiusTiles + 1) {
          return false;
        }
      }
      return true;
    });

    if (candidates.length === 0) {
      return null;
    }
    const picked = host.eventRng.pick(candidates);
    return { x: picked.x, y: picked.y };
  }
}
