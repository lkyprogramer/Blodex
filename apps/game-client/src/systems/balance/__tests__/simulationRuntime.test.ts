import { describe, expect, it } from "vitest";
import { defaultBaseStats, deriveStats, type BuffInstance, type PlayerState } from "@blodex/core";
import type { MonsterRuntime } from "../../EntityManager";
import {
  applyPassiveRegenForSimulation,
  applyResolvedBuffsForSimulation,
  createSimulationRegenAccumulator,
  updateSimulationBuffs
} from "../simulationRuntime";

function createPlayer(): PlayerState {
  const baseStats = defaultBaseStats();
  const derivedStats = deriveStats(baseStats, []);
  return {
    id: "player-1",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    pendingLevelUpChoices: 0,
    pendingSkillChoices: 0,
    health: derivedStats.maxHealth,
    mana: 0,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: [null, null],
      cooldowns: {}
    },
    activeBuffs: []
  };
}

function createMonster(): MonsterRuntime {
  return {
    state: {
      id: "monster-1",
      archetypeId: "melee_grunt",
      level: 1,
      health: 20,
      maxHealth: 20,
      damage: 4,
      attackRange: 1.5,
      moveSpeed: 120,
      xpValue: 3,
      dropTableId: "starter_floor",
      position: { x: 1, y: 0 },
      aiState: "attack",
      aiBehavior: "chase",
      activeBuffs: []
    },
    archetype: {
      id: "melee_grunt",
      name: "Melee",
      spriteId: "monster_melee_01",
      healthMultiplier: 1,
      damageMultiplier: 1,
      moveSpeed: 120,
      attackRange: 1.5,
      aiConfig: {
        behavior: "chase",
        attackCooldownMs: 1000,
        chaseRange: 4
      },
      xpValue: 3,
      dropTableId: "starter_floor"
    },
    baseMoveSpeed: 120,
    sprite: { destroy() {} } as MonsterRuntime["sprite"],
    healthBarBg: { destroy() {} } as MonsterRuntime["healthBarBg"],
    healthBarFg: { destroy() {} } as MonsterRuntime["healthBarFg"],
    affixMarker: undefined,
    healthBarYOffset: 0,
    yOffset: 0,
    nextAttackAt: 0,
    nextSupportAt: 0
  };
}

describe("simulationRuntime", () => {
  it("accumulates passive mana regen across short ticks", () => {
    let player = createPlayer();
    let accumulator = createSimulationRegenAccumulator();

    for (let index = 0; index < 5; index += 1) {
      const next = applyPassiveRegenForSimulation(player, 120, accumulator);
      player = next.player;
      accumulator = next.accumulator;
    }

    expect(player.mana).toBe(1);
    expect(accumulator.manaCarry).toBeCloseTo(0.2);
  });

  it("applies and expires player/monster buffs in the simulator", () => {
    const player = createPlayer();
    const monster = createMonster();
    const buffs: BuffInstance[] = [
      {
        defId: "war_cry",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 100,
        expiresAtMs: 6100
      },
      {
        defId: "frost_slow",
        sourceId: "player-1",
        targetId: "monster-1",
        appliedAtMs: 100,
        expiresAtMs: 3100
      }
    ];

    const buffedPlayer = applyResolvedBuffsForSimulation(player, [monster], buffs);

    expect(buffedPlayer.derivedStats.attackPower).toBeGreaterThan(player.derivedStats.attackPower);
    expect(monster.state.moveSpeed).toBe(60);

    const expiredPlayer = updateSimulationBuffs(buffedPlayer, [monster], 7000);

    expect(expiredPlayer.derivedStats.attackPower).toBe(player.derivedStats.attackPower);
    expect(monster.state.moveSpeed).toBe(120);
  });
});
