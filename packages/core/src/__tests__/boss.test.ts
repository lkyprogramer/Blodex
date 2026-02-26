import { describe, expect, it } from "vitest";
import { resolveBossAttack } from "../boss";
import { SeededRng } from "../rng";
import type { BossAttack, BossRuntimeState, PlayerState } from "../contracts/types";

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
});
