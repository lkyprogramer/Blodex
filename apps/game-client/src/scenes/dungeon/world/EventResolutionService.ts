import {
  addRunObols,
  applyXpGain,
  canPayEventCost,
  collectLoot,
  grantConsumable,
  rollItemDrop,
  spendRunObols,
  type EventReward
} from "@blodex/core";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP } from "@blodex/content";
import { t } from "../../../i18n";
import type { RuntimeEventHost } from "./types";

export interface EventResolutionServiceOptions {
  host: RuntimeEventHost;
}

export class EventResolutionService {
  constructor(private readonly options: EventResolutionServiceOptions) {}

  applyCost(nowMs: number, eventId: string, choiceId: string): boolean {
    const host = this.options.host;
    if (host.eventNode === null) {
      return false;
    }
    const choice = host.eventNode.eventDef.choices.find((entry: { id: string }) => entry.id === choiceId);
    if (choice === undefined) {
      return false;
    }
    const cost = choice.cost;
    if (!canPayEventCost(cost, host.player.health, host.player.mana, host.run.runEconomy.obols)) {
      const reason =
        cost === undefined
          ? t("ui.event.choice.invalid_cost")
          : t("ui.event.choice.need_cost_short", {
              amount: cost.amount,
              type: cost.type
            });
      host.runLog.appendKey(
        "log.event.choice_cannot_choose",
        {
          choiceName: host.contentLocalizer.eventChoiceName(eventId, choice.id, choice.name),
          reason
        },
        "warn",
        nowMs
      );
      host.eventRuntimeModule.openEventPanel(nowMs);
      return false;
    }

    if (cost !== undefined) {
      if (cost.type === "health") {
        host.player = {
          ...host.player,
          health: Math.max(1, host.player.health - cost.amount)
        };
      } else if (cost.type === "mana") {
        host.player = {
          ...host.player,
          mana: Math.max(0, host.player.mana - cost.amount)
        };
      } else {
        host.run = spendRunObols(host.run, cost.amount);
      }
      host.runLog.appendKey(
        "log.event.cost_paid",
        {
          eventId,
          choiceId,
          amount: cost.amount,
          costType: cost.type
        },
        "warn",
        nowMs
      );
    }

    return true;
  }

  applyReward(reward: EventReward, nowMs: number, source: string): void {
    const host = this.options.host;
    if (reward.type === "health") {
      host.player = {
        ...host.player,
        health: Math.min(host.player.derivedStats.maxHealth, host.player.health + reward.amount)
      };
      host.runLog.appendKey(
        "log.event.reward.health",
        {
          source,
          amount: reward.amount
        },
        "success",
        nowMs
      );
      return;
    }
    if (reward.type === "mana") {
      host.player = {
        ...host.player,
        mana: Math.min(host.player.derivedStats.maxMana, host.player.mana + reward.amount)
      };
      host.runLog.appendKey(
        "log.event.reward.mana",
        {
          source,
          amount: reward.amount
        },
        "success",
        nowMs
      );
      return;
    }
    if (reward.type === "obol") {
      host.run = addRunObols(host.run, reward.amount);
      host.runLog.appendKey(
        "log.event.reward.obol",
        {
          source,
          amount: reward.amount
        },
        "success",
        nowMs
      );
      return;
    }
    if (reward.type === "xp") {
      const xpResult = applyXpGain(host.player, reward.amount, "intelligence");
      host.player = host.refreshPlayerStatsFromEquipment(xpResult.player);
      host.runLog.appendKey(
        "log.event.reward.xp",
        {
          source,
          amount: reward.amount
        },
        "success",
        nowMs
      );
      if (xpResult.leveledUp) {
        host.eventBus.emit("player:levelup", {
          playerId: host.player.id,
          level: host.player.level,
          timestampMs: nowMs
        });
        host.offerLevelupSkill();
      }
      return;
    }
    if (reward.type === "mapping") {
      host.mapRevealActive = true;
      host.runLog.appendKey(
        "log.event.reward.mapping",
        {
          source
        },
        "info",
        nowMs
      );
      return;
    }
    if (reward.type === "consumable") {
      host.consumables = grantConsumable(host.consumables, reward.consumableId, reward.amount);
      host.runLog.appendKey(
        "log.event.reward.consumable",
        {
          source,
          amount: reward.amount,
          consumableId: reward.consumableId
        },
        "success",
        nowMs
      );
      return;
    }
    if (reward.type === "deferred_outcome") {
      host.deferredOutcomeRuntime.enqueue(
        {
          source: reward.source ?? "event",
          trigger: reward.trigger,
          reward: reward.reward
        },
        nowMs
      );
      host.runLog.append(
        `Deferred outcome queued from ${source}.`,
        "info",
        nowMs
      );
      return;
    }

    const lootTableId = reward.lootTableId;
    const table =
      reward.itemDefId === undefined
        ? lootTableId === undefined
          ? undefined
          : LOOT_TABLE_MAP[lootTableId]
        : {
            id: `event-${reward.itemDefId}`,
            entries: [{ itemDefId: reward.itemDefId, weight: 1, minFloor: 1 }]
          };
    if (table === undefined) {
      host.runLog.appendKey(
        "log.event.reward.item_table_missing",
        {
          source
        },
        "warn",
        nowMs
      );
      return;
    }

    const item = rollItemDrop(table, ITEM_DEF_MAP, host.run.currentFloor, host.lootRng, `event-${Math.floor(nowMs)}-${host.run.currentFloor}`, {
      isItemEligible: (itemDef) => host.isItemDefUnlocked(itemDef)
    });
    if (item === null) {
      host.runLog.appendKey(
        "log.event.reward.item_roll_failed",
        {
          source
        },
        "warn",
        nowMs
      );
      return;
    }

    host.player = collectLoot(host.player, item);
    host.run = {
      ...host.run,
      lootCollected: host.run.lootCollected + 1
    };
    host.runLog.appendKey(
      "log.event.reward.item_acquired",
      {
        source,
        itemName: host.contentLocalizer.itemName(item.defId, item.name)
      },
      "success",
      nowMs
    );
  }

  applyPenalty(reward: EventReward, nowMs: number, source: string): void {
    const host = this.options.host;
    if (reward.type === "health") {
      host.player = {
        ...host.player,
        health: Math.max(0, host.player.health - reward.amount)
      };
      host.runLog.appendKey(
        "log.event.penalty.health",
        {
          source,
          amount: reward.amount
        },
        "danger",
        nowMs
      );
      if (host.player.health <= 0) {
        host.lastDeathReason = t("log.event.penalty.death_reason", { amount: reward.amount });
      }
      return;
    }
    if (reward.type === "mana") {
      host.player = {
        ...host.player,
        mana: Math.max(0, host.player.mana - reward.amount)
      };
      host.runLog.appendKey(
        "log.event.penalty.mana",
        {
          source,
          amount: reward.amount
        },
        "warn",
        nowMs
      );
      return;
    }
    if (reward.type === "obol") {
      const spent = Math.min(host.run.runEconomy.obols, reward.amount);
      host.run = spendRunObols(host.run, spent);
      host.runLog.appendKey(
        "log.event.penalty.obol",
        {
          source,
          amount: spent
        },
        "warn",
        nowMs
      );
      return;
    }

    host.runLog.appendKey(
      "log.event.penalty.ignored",
      {
        source,
        rewardType: reward.type
      },
      "warn",
      nowMs
    );
  }
}
