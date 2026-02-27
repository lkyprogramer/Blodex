import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import { resolveBiomeForFloorBySeed } from "../biome";
import { createHazardRuntimeState, shouldRunHazardTick } from "../hazard";
import { applyAffixesToMonsterState, rollMonsterAffixes } from "../monsterAffix";
import type { MonsterState } from "../contracts/types";

function makeMonster(id: string): MonsterState {
  return {
    id,
    archetypeId: "magma_crawler",
    level: 4,
    health: 120,
    maxHealth: 120,
    damage: 22,
    attackRange: 1,
    moveSpeed: 102,
    xpValue: 20,
    dropTableId: "starter_floor",
    position: { x: 3, y: 3 },
    aiState: "idle"
  };
}

describe("integration biome-hazard-affix", () => {
  it("keeps deterministic biome/hazard/affix sequence for same seed", () => {
    const seed = "phase2a-integration";
    const biomesA = [resolveBiomeForFloorBySeed(3, seed), resolveBiomeForFloorBySeed(4, seed)];
    const biomesB = [resolveBiomeForFloorBySeed(3, seed), resolveBiomeForFloorBySeed(4, seed)];
    expect(biomesA).toEqual(biomesB);

    const hazardA = createHazardRuntimeState(
      {
        id: "lava_pool",
        type: "damage_zone",
        damagePerTick: 12,
        tickIntervalMs: 700,
        radiusTiles: 1.1,
        spriteKey: "telegraph_circle_red"
      },
      "hz-a",
      { x: 4, y: 4 },
      1_000
    );
    const hazardB = createHazardRuntimeState(
      {
        id: "lava_pool",
        type: "damage_zone",
        damagePerTick: 12,
        tickIntervalMs: 700,
        radiusTiles: 1.1,
        spriteKey: "telegraph_circle_red"
      },
      "hz-a",
      { x: 4, y: 4 },
      1_000
    );
    expect(hazardA).toEqual(hazardB);
    expect(shouldRunHazardTick(1_500, hazardA.nextTickAtMs)).toBe(false);
    expect(shouldRunHazardTick(1_700, hazardA.nextTickAtMs)).toBe(true);

    const rngA = new SeededRng(seed);
    const rngB = new SeededRng(seed);
    const affixA = rollMonsterAffixes({ floor: 4, isBoss: false, rng: rngA });
    const affixB = rollMonsterAffixes({ floor: 4, isBoss: false, rng: rngB });
    expect(affixA).toEqual(affixB);

    const monsterA = applyAffixesToMonsterState({
      ...makeMonster("a"),
      affixes: affixA
    });
    const monsterB = applyAffixesToMonsterState({
      ...makeMonster("a"),
      affixes: affixB
    });
    expect(monsterA).toEqual(monsterB);
  });
});

