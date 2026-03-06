import { BIOME_MAP } from "@blodex/content";
import {
  resolveEquippedWeaponType,
  type BossAttack,
  type CombatEvent,
  type GameEventMap,
  type ItemInstance,
  type PlayerState,
  type HazardType,
  type RunSummary,
  type TypedEventBus
} from "@blodex/core";
import { t } from "../../../i18n";
import { LEVEL_UP_FEEDBACK_PROFILE } from "../../../systems/feedback/LevelUpFeedbackProfile";
import {
  consumableFailureReasonLabel,
  difficultyLabel,
  equipmentSlotLabel,
  hazardTypeLabel
} from "./labelResolvers";

const ITEM_NEWLY_ACQUIRED_TTL_MS = 2_000;

interface DomainEventRunLog {
  append(message: string, level: string, timestampMs: number): void;
  appendKey(key: string, params: Record<string, unknown> | undefined, level: string, timestampMs: number): void;
}

interface DomainEventContentLocalizer {
  itemName(itemDefId: string, fallback: string): string;
  biomeName(biomeId: string, fallback: string): string;
}

interface DomainEventHostTime {
  now: number;
}

interface DomainEventUiPersistence {
  scheduleRunSave(): void;
  flushRunSave(): void;
}

export interface DomainEventEffectHost extends DomainEventUiPersistence {
  eventBus: TypedEventBus<GameEventMap>;
  player: PlayerState;
  routeFeedback(input: { type: string; [key: string]: unknown }): void;
  hudDirty: boolean;
  resolveEntityLabel(entityId: string): string;
  runLog: DomainEventRunLog;
  lastDeathReason: string;
  contentLocalizer: DomainEventContentLocalizer;
  newlyAcquiredItemUntilMs: Map<string, number>;
  nextTransientHudRefreshAt: number;
  levelUpPulseUntilMs: number;
  levelUpPulseLevel: number | null;
  time: DomainEventHostTime;
  currentBiome: {
    id: string;
  };
}

export function bindDomainEventEffects(host: DomainEventEffectHost): void {
    host.eventBus.on("combat:hit", ({ combat }) => {
      const weaponType =
        combat.sourceId === host.player.id ? resolveEquippedWeaponType(host.player) : undefined;
      host.routeFeedback({
        type: "combat:hit",
        combat,
        ...(weaponType === undefined ? {} : { weaponType })
      });
      host.hudDirty = true;
      const source = host.resolveEntityLabel(combat.sourceId);
      const target = host.resolveEntityLabel(combat.targetId);
      if (combat.targetId === host.player.id) {
        host.runLog.appendKey(
          "log.combat.player_hit",
          {
            source,
            target,
            amount: combat.amount
          },
          combat.kind === "crit" ? "danger" : "warn",
          combat.timestampMs
        );
        return;
      }
      host.runLog.appendKey(
        combat.kind === "crit" ? "log.combat.critical_hit" : "log.combat.hit",
        {
          source,
          target,
          amount: combat.amount
        },
        combat.kind === "crit" ? "success" : "info",
        combat.timestampMs
      );
    });

    host.eventBus.on("combat:dodge", ({ combat }) => {
      host.routeFeedback({
        type: "combat:dodge",
        combat
      });
      host.hudDirty = true;
      const source = host.resolveEntityLabel(combat.sourceId);
      const target = host.resolveEntityLabel(combat.targetId);
      host.runLog.appendKey(
        "log.combat.dodge",
        {
          source,
          target
        },
        combat.targetId === host.player.id ? "success" : "info",
        combat.timestampMs
      );
    });

    host.eventBus.on("combat:death", ({ combat }) => {
      host.routeFeedback({
        type: "combat:death",
        combat
      });
      host.hudDirty = true;
      const source = host.resolveEntityLabel(combat.sourceId);
      const target = host.resolveEntityLabel(combat.targetId);
      if (combat.targetId === host.player.id) {
        host.lastDeathReason = t("log.combat.death_reason", {
          source,
          amount: combat.amount,
          damageType: combat.damageType
        });
        host.runLog.appendKey(
          "log.combat.slain",
          {
            source,
            target
          },
          "danger",
          combat.timestampMs
        );
        return;
      }
      host.runLog.appendKey(
        "log.combat.slain",
        {
          source,
          target
        },
        "success",
        combat.timestampMs
      );
    });

    host.eventBus.on("loot:drop", ({ sourceId, item, timestampMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.loot.drop",
        {
          source: host.resolveEntityLabel(sourceId),
          itemName: host.contentLocalizer.itemName(item.defId, item.name)
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("loot:pickup", ({ item, timestampMs }) => {
      host.hudDirty = true;
      const expiresAtMs = timestampMs + ITEM_NEWLY_ACQUIRED_TTL_MS;
      host.newlyAcquiredItemUntilMs.set(item.id, expiresAtMs);
      host.nextTransientHudRefreshAt = Math.min(host.nextTransientHudRefreshAt, expiresAtMs);
      host.runLog.appendKey(
        "log.loot.pickup",
        {
          itemName: host.contentLocalizer.itemName(item.defId, item.name)
        },
        "success",
        timestampMs
      );
    });

    host.eventBus.on("player:levelup", ({ playerId, level, timestampMs }) => {
      host.routeFeedback({
        type: "player:levelup",
        playerId,
        level
      });
      host.levelUpPulseUntilMs = Math.max(
        host.levelUpPulseUntilMs ?? 0,
        timestampMs + LEVEL_UP_FEEDBACK_PROFILE.hudPulseDurationMs
      );
      host.levelUpPulseLevel = level;
      host.nextTransientHudRefreshAt = Math.min(
        host.nextTransientHudRefreshAt,
        host.levelUpPulseUntilMs
      );
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.player.level_up",
        {
          player: host.resolveEntityLabel(host.player.id),
          level
        },
        "success",
        timestampMs
      );
    });

    host.eventBus.on("item:equip", ({ item, slot, timestampMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.item.equipped",
        {
          itemName: host.contentLocalizer.itemName(item.defId, item.name),
          slot: equipmentSlotLabel(slot)
        },
        "success",
        timestampMs
      );
    });

    host.eventBus.on("item:unequip", ({ item, slot, timestampMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.item.unequipped",
        {
          itemName: host.contentLocalizer.itemName(item.defId, item.name),
          slot: equipmentSlotLabel(slot)
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("skill:use", ({ playerId, skillId, timestampMs }) => {
      host.routeFeedback({
        type: "skill:use",
        skillId,
        playerId
      });
      host.runLog.appendKey(
        "log.skill.used",
        {
          skillId
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("skill:cooldown", ({ skillId, readyAtMs }) => {
      const cooldownMs = Math.max(0, readyAtMs - host.time.now);
      host.runLog.appendKey(
        "log.skill.cooldown",
        {
          skillId,
          seconds: (cooldownMs / 1000).toFixed(1)
        },
        "info",
        host.time.now
      );
    });

    host.eventBus.on("buff:apply", ({ buff, timestampMs }) => {
      host.runLog.append(
        `Buff observed: ${buff.defId} on ${host.resolveEntityLabel(buff.targetId)} for ${Math.max(
          0,
          buff.expiresAtMs - buff.appliedAtMs
        )}ms.`,
        "info",
        timestampMs
      );
    });

    host.eventBus.on("player_facing_choice", ({ floor, source, timestampMs }) => {
      host.runLog.append(
        `Player-facing choice surfaced on floor ${floor}: ${source}.`,
        "info",
        timestampMs
      );
    });

    host.eventBus.on("power_spike", ({ floor, source, itemDefId, rarity, timestampMs }) => {
      host.runLog.append(
        `Power spike detected on floor ${floor} via ${source}${itemDefId === undefined ? "" : ` (${itemDefId}:${rarity ?? "unknown"})`}.`,
        "success",
        timestampMs
      );
    });

    host.eventBus.on("build_formed", ({ floor, source, tags, timestampMs }) => {
      host.runLog.append(
        `Build formed on floor ${floor} via ${source}: ${tags.join(", ")}.`,
        "success",
        timestampMs
      );
    });

    host.eventBus.on("rare_drop_presented", ({ floor, itemDefId, rarity, timestampMs }) => {
      host.runLog.append(
        `Rare drop presented on floor ${floor}: ${itemDefId} (${rarity}).`,
        "success",
        timestampMs
      );
    });

    host.eventBus.on("boss_reward_closed", ({ choiceId, timestampMs }) => {
      host.runLog.append(
        `Boss reward closed with choice: ${choiceId}.`,
        "info",
        timestampMs
      );
    });

    host.eventBus.on("combat_rhythm_window", ({ floor, metrics, timestampMs }) => {
      host.runLog.append(
        `Combat rhythm baseline @ floor ${floor}: ${metrics.skillCastsPer30s.toFixed(1)} casts / 30s, ${Math.round(
          metrics.autoAttackDamageShare * 100
        )}% auto share, ${metrics.averageNoInputGapMs.toFixed(0)}ms average idle gap.`,
        "info",
        timestampMs
      );
    });

    host.eventBus.on("synergy_activated", ({ floor, synergyId, timestampMs }) => {
      host.runLog.append(
        `Synergy activated on floor ${floor}: ${synergyId}.`,
        "success",
        timestampMs
      );
    });

    host.eventBus.on("consumable:use", ({ consumableId, amountApplied, remainingCharges, timestampMs }) => {
      host.routeFeedback({
        type: "consumable:use",
        consumableId
      });
      host.hudDirty = true;
      if (consumableId === "health_potion") {
        host.runLog.appendKey(
          "log.consumable.health_potion_used",
          {
            amount: amountApplied,
            remainingCharges
          },
          "success",
          timestampMs
        );
      } else if (consumableId === "mana_potion") {
        host.runLog.appendKey(
          "log.consumable.mana_potion_used",
          {
            amount: amountApplied,
            remainingCharges
          },
          "success",
          timestampMs
        );
      } else {
        host.runLog.appendKey(
          "log.consumable.scroll_mapping_used",
          {
            remainingCharges
          },
          "success",
          timestampMs
        );
      }
    });

    host.eventBus.on("consumable:failed", ({ consumableId, reason, timestampMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.consumable.cannot_use",
        {
          consumableId,
          reason: consumableFailureReasonLabel(reason)
        },
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("event:spawn", ({ eventId, eventName, floor, timestampMs }) => {
      host.routeFeedback({
        type: "event:spawn",
        eventId
      });
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.event.discovered",
        {
          floor,
          eventName
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("event:choice", ({ eventId, choiceId, timestampMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.event.choice_selected",
        {
          eventId,
          choiceId
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("merchant:offer", ({ floor, offerCount, timestampMs }) => {
      host.routeFeedback({
        type: "merchant:offer"
      });
      host.runLog.appendKey(
        "log.merchant.opened",
        {
          floor,
          offerCount
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("merchant:purchase", ({ itemName, priceObol, timestampMs }) => {
      host.routeFeedback({
        type: "merchant:purchase"
      });
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.merchant.purchased",
        {
          itemName,
          priceObol
        },
        "success",
        timestampMs
      );
      host.scheduleRunSave();
    });

    host.eventBus.on("monster:stateChange", ({ monsterId, from, to, timestampMs }) => {
      host.runLog.appendKey(
        "log.monster.state_changed",
        {
          monsterName: host.resolveEntityLabel(monsterId),
          from,
          to
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("monster:affixApplied", ({ monsterId, affixId, timestampMs }) => {
      host.runLog.appendKey(
        "log.monster.affix_applied",
        {
          monsterName: host.resolveEntityLabel(monsterId),
          affixId
        },
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("monster:split", ({ sourceMonsterId, spawnedIds, timestampMs }) => {
      host.runLog.appendKey(
        "log.monster.split",
        {
          monsterName: host.resolveEntityLabel(sourceMonsterId),
          count: spawnedIds.length
        },
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("monster:leech", ({ monsterId, amount, targetId, timestampMs }) => {
      host.runLog.appendKey(
        "log.monster.leech",
        {
          monsterName: host.resolveEntityLabel(monsterId),
          amount,
          target: host.resolveEntityLabel(targetId)
        },
        "danger",
        timestampMs
      );
    });

    host.eventBus.on("run:start", ({ floor, runSeed, difficulty, startedAtMs }) => {
      host.routeFeedback({
        type: "run:start",
        biomeId: host.currentBiome.id
      });
      host.runLog.appendKey(
        "log.run.started",
        {
          floor,
          difficulty: difficultyLabel(difficulty),
          runSeed
        },
        "info",
        startedAtMs
      );
    });

    host.eventBus.on("run:end", ({ summary, finishedAtMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        summary.isVictory ? "log.run.completed_victory" : "log.run.completed_defeat",
        {
          floor: summary.floorReached,
          level: summary.leveledTo
        },
        summary.isVictory ? "success" : "danger",
        finishedAtMs
      );
    });

    host.eventBus.on("floor:enter", ({ floor, biomeId, timestampMs }) => {
      host.routeFeedback({
        type: "floor:enter",
        ...(biomeId === undefined ? {} : { biomeId })
      });
      host.hudDirty = true;
      const biomeName =
        biomeId === undefined
          ? ""
          : host.contentLocalizer.biomeName(
              biomeId,
              BIOME_MAP[biomeId]?.name ?? biomeId
            );
      host.runLog.appendKey(
        biomeName.length > 0 ? "log.floor.entered_biome" : "log.floor.entered",
        biomeName.length > 0
          ? {
              floor,
              biomeName
            }
          : {
              floor
            },
        "info",
        timestampMs
      );
      host.flushRunSave();
    });

    host.eventBus.on("floor:clear", ({ floor, kills, timestampMs }) => {
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.floor.cleared",
        {
          floor,
          kills
        },
        "success",
        timestampMs
      );
    });

    host.eventBus.on("boss:phaseChange", ({ bossId, toPhase, hpRatio, timestampMs }) => {
      host.routeFeedback({
        type: "boss:phaseChange",
        bossId
      });
      host.hudDirty = true;
      host.runLog.appendKey(
        "log.boss.phase_shifted",
        {
          phase: toPhase + 1,
          hpPercent: Math.floor(hpRatio * 100)
        },
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("boss:summon", ({ count, timestampMs }) => {
      host.runLog.appendKey(
        "log.boss.summoned_minions",
        {
          count
        },
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("boss:attack_intent", ({ attack, executeAtMs, target, timestampMs }) => {
      const seconds = Math.max(0, (executeAtMs - timestampMs) / 1000).toFixed(1);
      host.runLog.append(
        target === undefined
          ? `Boss telegraphs ${attack.id}, resolving in ${seconds}s.`
          : `Boss telegraphs ${attack.id} at (${target.x.toFixed(1)}, ${target.y.toFixed(1)}), resolving in ${seconds}s.`,
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("boss:attack_resolve", ({ attack, timestampMs }) => {
      host.runLog.append(`Boss executes ${attack.id}.`, "info", timestampMs);
    });

    host.eventBus.on("hazard:enter", ({ hazardType, targetId, timestampMs }) => {
      if (targetId !== host.player.id) {
        return;
      }
      host.runLog.appendKey(
        "log.hazard.entered_zone",
        {
          hazardType: hazardTypeLabel(hazardType)
        },
        "warn",
        timestampMs
      );
    });

    host.eventBus.on("hazard:exit", ({ hazardType, targetId, timestampMs }) => {
      if (targetId !== host.player.id) {
        return;
      }
      host.runLog.appendKey(
        "log.hazard.left_zone",
        {
          hazardType: hazardTypeLabel(hazardType)
        },
        "info",
        timestampMs
      );
    });

    host.eventBus.on("hazard:trigger", ({ hazardType, position, timestampMs }) => {
      host.routeFeedback({
        type: "hazard:trigger",
        hazardType,
        position
      });
      if (hazardType !== "periodic_trap") {
        host.runLog.appendKey(
          "log.hazard.triggered",
          {
            hazardType: hazardTypeLabel(hazardType)
          },
          "warn",
          timestampMs
        );
      }
    });

    host.eventBus.on("hazard:damage", ({ hazardType, targetId, amount, remainingHealth, timestampMs }) => {
      if (hazardType === "periodic_trap" && targetId !== host.player.id) {
        return;
      }
      const label = host.resolveEntityLabel(targetId);
      const level = targetId === host.player.id ? "danger" : "info";
      host.runLog.appendKey(
        "log.hazard.damage",
        {
          target: label,
          amount,
          hazardType: hazardTypeLabel(hazardType),
          remainingHealth: Math.floor(remainingHealth)
        },
        level,
        timestampMs
      );
      host.hudDirty = true;
    });
}
