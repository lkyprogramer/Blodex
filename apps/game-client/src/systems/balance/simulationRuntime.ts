import {
  aggregateBuffEffects,
  applyBuff,
  deriveStats,
  resolveHealthRegenTick,
  resolveSpecialAffixTotals,
  updateBuffs,
  type BuffInstance,
  type ItemInstance,
  type PlayerState,
  type SkillResolution
} from "@blodex/core";
import { BUFF_DEF_MAP } from "@blodex/content";
import type { MonsterRuntime } from "../EntityManager";

const PASSIVE_MANA_REGEN_PER_SECOND = 2;

export interface SimulationRegenAccumulator {
  healthCarry: number;
  manaCarry: number;
}

export function createSimulationRegenAccumulator(): SimulationRegenAccumulator {
  return {
    healthCarry: 0,
    manaCarry: 0
  };
}

function refreshSimulatedPlayer(player: PlayerState): PlayerState {
  const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
  const buffEffects = aggregateBuffEffects(player.activeBuffs ?? [], BUFF_DEF_MAP);
  const derivedStats = deriveStats(player.baseStats, equipped, buffEffects);
  return {
    ...player,
    derivedStats,
    health: Math.min(player.health, derivedStats.maxHealth),
    mana: Math.min(player.mana, derivedStats.maxMana)
  };
}

function refreshSimulatedMonster(monster: MonsterRuntime): void {
  const buffEffects = aggregateBuffEffects(monster.state.activeBuffs ?? [], BUFF_DEF_MAP);
  monster.state = {
    ...monster.state,
    moveSpeed: Number(((monster.baseMoveSpeed ?? monster.state.moveSpeed) * (buffEffects.slowMultiplier ?? 1)).toFixed(2))
  };
}

export function applyResolvedBuffsForSimulation(
  player: PlayerState,
  monsters: MonsterRuntime[],
  buffs: SkillResolution["buffsApplied"]
): PlayerState {
  let nextPlayer = player;
  let playerBuffChanged = false;
  for (const buff of buffs) {
    if (buff.targetId === player.id) {
      nextPlayer = {
        ...nextPlayer,
        activeBuffs: applyBuff(nextPlayer.activeBuffs ?? [], buff)
      };
      playerBuffChanged = true;
      continue;
    }
    const monster = monsters.find((entry) => entry.state.id === buff.targetId);
    if (monster === undefined) {
      continue;
    }
    monster.state = {
      ...monster.state,
      activeBuffs: applyBuff(monster.state.activeBuffs ?? [], buff)
    };
    refreshSimulatedMonster(monster);
  }
  return playerBuffChanged ? refreshSimulatedPlayer(nextPlayer) : nextPlayer;
}

export function updateSimulationBuffs(
  player: PlayerState,
  monsters: MonsterRuntime[],
  nowMs: number
): PlayerState {
  let nextPlayer = player;
  const playerBuffs = nextPlayer.activeBuffs ?? [];
  if (playerBuffs.length > 0) {
    const updated = updateBuffs(playerBuffs, nowMs);
    if (updated.expired.length > 0 || updated.active.length !== playerBuffs.length) {
      nextPlayer = refreshSimulatedPlayer({
        ...nextPlayer,
        activeBuffs: updated.active
      });
    }
  }

  for (const monster of monsters) {
    const activeBuffs = monster.state.activeBuffs ?? [];
    if (activeBuffs.length === 0) {
      continue;
    }
    const updated = updateBuffs(activeBuffs, nowMs);
    if (updated.expired.length === 0 && updated.active.length === activeBuffs.length) {
      continue;
    }
    monster.state = {
      ...monster.state,
      activeBuffs: updated.active
    };
    refreshSimulatedMonster(monster);
  }

  return nextPlayer;
}

export function applyPassiveRegenForSimulation(
  player: PlayerState,
  deltaMs: number,
  accumulator: SimulationRegenAccumulator
): {
  player: PlayerState;
  accumulator: SimulationRegenAccumulator;
} {
  const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
  const totals = resolveSpecialAffixTotals(equipped);
  const regen = resolveHealthRegenTick(
    player.health,
    player.derivedStats.maxHealth,
    totals.healthRegen,
    deltaMs,
    accumulator.healthCarry
  );
  if (player.mana >= player.derivedStats.maxMana) {
    const nextPlayer =
      regen.healed <= 0
        ? player
        : {
            ...player,
            health: regen.health
          };
    return {
      player: nextPlayer,
      accumulator: {
        healthCarry: regen.carry,
        manaCarry: 0
      }
    };
  }

  const manaPool = accumulator.manaCarry + (PASSIVE_MANA_REGEN_PER_SECOND * deltaMs) / 1000;
  const wholeMana = Math.floor(manaPool);
  const nextMana =
    wholeMana <= 0 ? player.mana : Math.min(player.derivedStats.maxMana, player.mana + wholeMana);
  const nextPlayer =
    regen.healed <= 0 && nextMana === player.mana
      ? player
      : {
          ...player,
          health: regen.healed <= 0 ? player.health : regen.health,
          mana: nextMana
        };
  return {
    player: nextPlayer,
    accumulator: {
      healthCarry: regen.carry,
      manaCarry: manaPool - wholeMana
    }
  };
}
