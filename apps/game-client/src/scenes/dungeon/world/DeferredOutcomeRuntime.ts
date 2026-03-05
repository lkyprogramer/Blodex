import {
  addRunObols,
  collectLoot,
  rollItemDrop,
  type DeferredOutcomeState,
  type ItemDef
} from "@blodex/core";
import { ITEM_DEF_MAP } from "@blodex/content";

export interface DeferredOutcomeHost {
  [key: string]: any;
}

export interface DeferredOutcomeRuntimeOptions {
  host: DeferredOutcomeHost;
}

export class DeferredOutcomeRuntime {
  constructor(private readonly options: DeferredOutcomeRuntimeOptions) {}

  enqueue(payload: Omit<DeferredOutcomeState, "outcomeId" | "status">, nowMs: number): void {
    const host = this.options.host;
    const cursor = host.eventRng?.getCursor?.() ?? 0;
    const outcomeId = `${payload.source}-${host.run.currentFloor}-${host.deferredOutcomes.length + 1}-${cursor}`;
    host.deferredOutcomes.push({
      outcomeId,
      source: payload.source,
      trigger: payload.trigger,
      reward: payload.reward,
      status: "pending"
    });
    host.runLog.append(
      `Deferred outcome queued (${outcomeId}) via ${payload.source}.`,
      "info",
      nowMs
    );
    host.scheduleRunSave();
    if (payload.trigger.type === "floor_reached" && host.run.currentFloor >= payload.trigger.value) {
      this.settle("floor_reached", nowMs);
    }
  }

  settle(triggerType: "floor_reached" | "boss_kill" | "run_end", nowMs: number): void {
    const host = this.options.host;
    let settledAny = false;
    host.deferredOutcomes = host.deferredOutcomes.map((outcome: DeferredOutcomeState) => {
      if (outcome.status !== "pending") {
        return outcome;
      }

      const shouldSettle =
        outcome.trigger.type === "floor_reached"
          ? triggerType === "floor_reached" && host.run.currentFloor >= outcome.trigger.value
          : outcome.trigger.type === triggerType;
      if (!shouldSettle) {
        return outcome;
      }

      settledAny = true;
      this.applyReward(outcome, nowMs);
      return {
        ...outcome,
        status: "settled"
      };
    });
    if (!settledAny) {
      return;
    }
    host.scheduleRunSave();
    host.hudDirty = true;
  }

  private applyReward(outcome: DeferredOutcomeState, nowMs: number): void {
    const host = this.options.host;
    const reward = outcome.reward;
    if ((reward.obol ?? 0) > 0) {
      host.run = addRunObols(host.run, reward.obol ?? 0);
      host.runLog.append(
        `Deferred outcome settled (${outcome.outcomeId}): +${reward.obol} obol.`,
        "success",
        nowMs
      );
    }
    if ((reward.shard ?? 0) > 0) {
      const shard = Math.max(0, Math.floor(reward.shard ?? 0));
      host.run = {
        ...host.run,
        deferredShardBonus: (host.run.deferredShardBonus ?? 0) + shard
      };
      host.runLog.append(
        `Deferred outcome settled (${outcome.outcomeId}): +${shard} shard reward banked.`,
        "success",
        nowMs
      );
    }
    if (reward.itemDefId === undefined) {
      return;
    }

    const item = rollItemDrop(
      {
        id: `deferred-${reward.itemDefId}`,
        entries: [{ itemDefId: reward.itemDefId, weight: 1, minFloor: 1 }]
      },
      ITEM_DEF_MAP,
      host.run.currentFloor,
      host.lootRng,
      `deferred-${outcome.outcomeId}`,
      host.resolveLootRollOptions({
        isItemEligible: (itemDef: ItemDef) => host.isItemDefUnlocked(itemDef)
      })
    );
    if (item === null) {
      return;
    }
    host.player = collectLoot(host.player, item);
    host.run = {
      ...host.run,
      lootCollected: host.run.lootCollected + 1
    };
    host.runLog.append(
      `Deferred outcome settled (${outcome.outcomeId}): ${host.contentLocalizer.itemName(item.defId, item.name)} acquired.`,
      "success",
      nowMs
    );
  }
}
