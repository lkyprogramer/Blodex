import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import {
  applyDamageToBoss,
  initBossState,
  markBossAttackUsed,
  resolveBossAttack,
  selectBossAttack,
  updateBossPhase
} from "../boss";
import type { BossAttack, BossDef, BossRuntimeState, PlayerState } from "../contracts/types";

const BOSS: BossDef = {
  id: "boss-1",
  name: "Boss",
  spriteKey: "boss",
  baseHealth: 200,
  dropTableId: "boss",
  exclusiveFloor: 5,
  phases: [
    {
      hpThreshold: 1,
      attackPattern: [{ id: "hit", cooldownMs: 1000, telegraphMs: 0, type: "melee", damage: 20, range: 2 }]
    },
    {
      hpThreshold: 0.5,
      attackPattern: [{ id: "rage", cooldownMs: 1000, telegraphMs: 0, type: "melee", damage: 30, range: 2 }]
    }
  ]
};

function makePlayer(): PlayerState {
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    health: 120,
    mana: 40,
    gold: 0,
    baseStats: { strength: 10, dexterity: 10, vitality: 10, intelligence: 6 },
    derivedStats: {
      maxHealth: 120,
      maxMana: 40,
      armor: 12,
      attackPower: 25,
      critChance: 0,
      attackSpeed: 1,
      moveSpeed: 140
    },
    inventory: [],
    equipment: {}
  };
}

function makeBoss(position: { x: number; y: number }): BossRuntimeState {
  return {
    bossId: "boss_1",
    currentPhaseIndex: 0,
    health: 500,
    maxHealth: 500,
    attackCooldowns: {},
    position,
    aiState: "attacking"
  };
}

function makeMeleeAttack(): BossAttack {
  return {
    id: "swipe",
    cooldownMs: 1000,
    telegraphMs: 500,
    type: "melee",
    damage: 30,
    range: 1
  };
}

describe("boss", () => {
  it("switches phase after crossing threshold", () => {
    let state = initBossState(BOSS, { x: 5, y: 5 });
    state = applyDamageToBoss(state, 120);
    state = updateBossPhase(state, BOSS);
    expect(state.currentPhaseIndex).toBe(1);
  });

  it("selects and resolves attack deterministically", () => {
    const rng = new SeededRng("boss-seed");
    let state = initBossState(BOSS, { x: 5, y: 5 });
    const attack = selectBossAttack(state, BOSS, 1000, rng);
    expect(attack?.id).toBe("hit");
    if (attack === null) {
      return;
    }
    const player = makePlayer();
    const result = resolveBossAttack(attack, state, player, rng, 1000);
    expect(result.player.health).toBeLessThanOrEqual(player.health);
    state = markBossAttackUsed(state, attack, 1000);
    expect(state.attackCooldowns.hit).toBe(2000);
  });
});

describe("boss combat", () => {
  it("does not apply damage when player is out of attack range", () => {
    const rng = new SeededRng("boss-range-miss");
    const player = { ...makePlayer(), position: { x: 5, y: 5 } };

    const result = resolveBossAttack(makeMeleeAttack(), makeBoss({ x: 0, y: 0 }), player, rng, 1000);

    expect(result.player.health).toBe(player.health);
    expect(result.events).toEqual([]);
  });

  it("applies damage when player is within attack range", () => {
    const rng = new SeededRng("boss-range-hit");
    const player = makePlayer();

    const result = resolveBossAttack(makeMeleeAttack(), makeBoss({ x: 0, y: 0 }), player, rng, 1000);

    expect(result.player.health).toBeLessThan(player.health);
    expect(result.events[0]?.kind).toBe("damage");
  });

  it("supports telegraph target windows for aoe attacks", () => {
    const rng = new SeededRng("boss-aoe-target");
    const player = makePlayer();
    const aoeAttack: BossAttack = {
      id: "bone_spikes",
      cooldownMs: 1800,
      telegraphMs: 1200,
      type: "aoe_zone",
      damage: 20,
      range: 6,
      radius: 1.3
    };

    const hit = resolveBossAttack(aoeAttack, makeBoss({ x: 0, y: 0 }), player, rng, 1000, {
      x: 0,
      y: 0
    });
    expect(hit.events[0]?.kind).toBe("damage");

    const dodged = resolveBossAttack(
      aoeAttack,
      makeBoss({ x: 0, y: 0 }),
      {
        ...player,
        position: { x: 2.2, y: 0 }
      },
      new SeededRng("boss-aoe-target"),
      2200,
      { x: 0, y: 0 }
    );
    expect(dodged.events).toEqual([]);
  });
});
