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
import type { BossDef, PlayerState } from "../contracts/types";

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

const PLAYER: PlayerState = {
  id: "p",
  position: { x: 0, y: 0 },
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  health: 100,
  mana: 40,
  baseStats: { strength: 8, dexterity: 8, vitality: 8, intelligence: 5 },
  derivedStats: {
    maxHealth: 100,
    maxMana: 40,
    armor: 5,
    attackPower: 18,
    critChance: 0.1,
    attackSpeed: 1,
    moveSpeed: 140
  },
  inventory: [],
  equipment: {},
  gold: 0
};

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
    const result = resolveBossAttack(attack, state, PLAYER, rng, 1000);
    expect(result.player.health).toBeLessThanOrEqual(PLAYER.health);
    state = markBossAttackUsed(state, attack, 1000);
    expect(state.attackCooldowns.hit).toBe(2000);
  });
});
