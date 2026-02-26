import {
  addRunObols,
  applyXpGain,
  deriveStats,
  resolveMonsterAttack,
  resolvePlayerAttack,
  rollItemDrop,
  type SkillDef,
  type SkillResolution,
  resolveSkill,
  type CombatEvent,
  type ItemDef,
  type ItemInstance,
  type LootTableDef,
  type RngLike,
  type PlayerState,
  type RunState
} from "@blodex/core";
import type { MonsterRuntime } from "./EntityManager";

interface PlayerCombatContext {
  player: PlayerState;
  run: RunState;
  monsters: MonsterRuntime[];
  attackTargetId: string | null;
  nextPlayerAttackAt: number;
  nowMs: number;
  combatRng: RngLike;
  lootRng: RngLike;
  itemDefs: Record<string, ItemDef>;
  lootTables: Record<string, LootTableDef>;
}

export interface PlayerCombatResult {
  player: PlayerState;
  run: RunState;
  attackTargetId: string | null;
  nextPlayerAttackAt: number;
  requestPathTarget?: { x: number; y: number };
  killedMonsterId?: string;
  droppedItem?: {
    item: ItemInstance;
    position: { x: number; y: number };
    sourceId: string;
  };
  combatEvents: CombatEvent[];
  leveledUp: boolean;
}

export interface MonsterCombatResult {
  player: PlayerState;
  combatEvents: CombatEvent[];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class CombatSystem {
  updatePlayerAttack(context: PlayerCombatContext): PlayerCombatResult {
    const target =
      context.attackTargetId === null
        ? undefined
        : context.monsters.find((monster) => monster.state.id === context.attackTargetId);

    if (target === undefined || target.state.health <= 0) {
      return {
        player: context.player,
        run: context.run,
        attackTargetId: null,
        nextPlayerAttackAt: context.nextPlayerAttackAt,
        combatEvents: [],
        leveledUp: false
      };
    }

    const dist = distance(context.player.position, target.state.position);
    if (dist > 1.5) {
      return {
        player: context.player,
        run: context.run,
        attackTargetId: context.attackTargetId,
        nextPlayerAttackAt: context.nextPlayerAttackAt,
        requestPathTarget: {
          x: Math.round(target.state.position.x),
          y: Math.round(target.state.position.y)
        },
        combatEvents: [],
        leveledUp: false
      };
    }

    if (context.nowMs < context.nextPlayerAttackAt) {
      return {
        player: context.player,
        run: context.run,
        attackTargetId: context.attackTargetId,
        nextPlayerAttackAt: context.nextPlayerAttackAt,
        combatEvents: [],
        leveledUp: false
      };
    }

    const nextPlayerAttackAt =
      context.nowMs + 1000 / Math.max(0.6, context.player.derivedStats.attackSpeed);
    const result = resolvePlayerAttack(context.player, target.state, context.combatRng, context.nowMs);
    target.state = result.monster;

    if (target.state.health > 0) {
      return {
        player: context.player,
        run: context.run,
        attackTargetId: context.attackTargetId,
        nextPlayerAttackAt,
        combatEvents: result.events,
        leveledUp: false
      };
    }

    const nextKills = context.run.kills + 1;
    const xpResult = applyXpGain(context.player, target.state.xpValue, "strength");
    const nextDerived = deriveStats(
      xpResult.player.baseStats,
      Object.values(context.player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );

    const nextPlayer = {
      ...xpResult.player,
      derivedStats: nextDerived,
      health: Math.min(context.player.health + 12, nextDerived.maxHealth),
      mana: Math.min(context.player.mana + 4, nextDerived.maxMana)
    };

    const lootTable = context.lootTables[target.state.dropTableId];
    const droppedItem =
      lootTable === undefined
        ? undefined
        : rollItemDrop(
            lootTable,
            context.itemDefs,
            context.run.currentFloor,
            context.lootRng,
            `${context.run.currentFloor}-${target.state.id}-${nextKills}`
          );

    const droppedItemPayload =
      droppedItem === null || droppedItem === undefined
        ? undefined
        : {
            item: droppedItem,
            position: { ...target.state.position },
            sourceId: target.state.id
          };

    return {
      player: nextPlayer,
      run: {
        ...addRunObols(context.run, 1),
        kills: nextKills,
        totalKills: context.run.totalKills + 1
      },
      attackTargetId: null,
      nextPlayerAttackAt,
      killedMonsterId: target.state.id,
      combatEvents: result.events,
      leveledUp: xpResult.leveledUp,
      ...(droppedItemPayload === undefined ? {} : { droppedItem: droppedItemPayload })
    };
  }

  useSkill(
    player: PlayerState,
    monsters: MonsterRuntime[],
    skillDef: SkillDef,
    rng: RngLike,
    nowMs: number
  ): SkillResolution {
    const snapshot = monsters.map((monster) => monster.state);
    const resolution = resolveSkill(player, snapshot, skillDef, rng, nowMs);
    const byId = new Map(resolution.affectedMonsters.map((monster) => [monster.id, monster]));
    for (const monster of monsters) {
      const next = byId.get(monster.state.id);
      if (next !== undefined) {
        monster.state = next;
      }
    }
    return resolution;
  }

  updateMonsterAttacks(
    monsters: MonsterRuntime[],
    player: PlayerState,
    nowMs: number,
    combatRng: RngLike
  ): MonsterCombatResult {
    const events: CombatEvent[] = [];
    let nextPlayer = player;

    for (const monster of monsters) {
      if (monster.state.health <= 0 || monster.state.aiState !== "attack") {
        continue;
      }

      if (distance(monster.state.position, nextPlayer.position) > monster.state.attackRange + 0.2) {
        continue;
      }

      if (nowMs < monster.nextAttackAt) {
        continue;
      }

      monster.nextAttackAt = nowMs + monster.archetype.aiConfig.attackCooldownMs;
      const result = resolveMonsterAttack(monster.state, nextPlayer, combatRng, nowMs);
      nextPlayer = result.player;
      monster.state = result.monster;
      events.push(...result.events);
    }

    return {
      player: nextPlayer,
      combatEvents: events
    };
  }
}
