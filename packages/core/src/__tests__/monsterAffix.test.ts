import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import {
  affixRollChanceForFloor,
  applyAffixesToMonsterState,
  rollMonsterAffixes
} from "../monsterAffix";
import type { MonsterState } from "../contracts/types";

function baseMonster(): MonsterState {
  return {
    id: "m1",
    archetypeId: "melee_grunt",
    level: 3,
    health: 100,
    maxHealth: 100,
    damage: 20,
    attackRange: 1,
    moveSpeed: 100,
    xpValue: 10,
    dropTableId: "starter_floor",
    position: { x: 1, y: 1 },
    aiState: "idle"
  };
}

describe("monster affix", () => {
  it("keeps floor 1-2 affix chance at zero", () => {
    expect(affixRollChanceForFloor(1)).toBe(0);
    expect(affixRollChanceForFloor(2)).toBe(0);
    expect(affixRollChanceForFloor(3)).toBeGreaterThan(0);
  });

  it("rolls deterministically with same seed", () => {
    const first = new SeededRng("affix-seed");
    const second = new SeededRng("affix-seed");

    const a = Array.from({ length: 8 }, () => rollMonsterAffixes({ floor: 4, isBoss: false, rng: first }));
    const b = Array.from({ length: 8 }, () => rollMonsterAffixes({ floor: 4, isBoss: false, rng: second }));

    expect(a).toEqual(b);
  });

  it("forces one affix in forceOne policy even on early floors", () => {
    const rng = new SeededRng("affix-force-one");
    const rolled = rollMonsterAffixes({
      floor: 1,
      isBoss: false,
      policy: "forceOne",
      availableAffixes: [],
      rng
    });

    expect(rolled).toHaveLength(1);
  });

  it("does not roll locked affixes when unlocked pool is empty", () => {
    const rolled = rollMonsterAffixes({
      floor: 4,
      isBoss: false,
      availableAffixes: [],
      rng: {
        next: () => 0,
        nextInt: (min: number) => min,
        pick: <T>(values: readonly T[]) => values[0] as T
      }
    });

    expect(rolled).toEqual([]);
  });

  it("applies stat-shaping affixes", () => {
    const frenzied = applyAffixesToMonsterState({
      ...baseMonster(),
      affixes: ["frenzied"]
    });
    const armored = applyAffixesToMonsterState({
      ...baseMonster(),
      affixes: ["armored"]
    });

    expect(frenzied.moveSpeed).toBeGreaterThan(100);
    expect(frenzied.damage).toBeGreaterThan(20);
    expect(armored.maxHealth).toBeGreaterThan(100);
    expect(armored.damage).toBeLessThan(20);
  });
});
