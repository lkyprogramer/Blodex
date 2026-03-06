import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import {
  affixRollChanceForFloor,
  applyAffixesToMonsterState,
  resolveMonsterBaseMoveSpeedWithAffixes,
  resolveMonsterAffixOnDealDamage,
  resolveMonsterAffixOnKilled,
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

  it("reuses the same frenzied move-speed rule for restore fallbacks", () => {
    const frenzied = applyAffixesToMonsterState({
      ...baseMonster(),
      affixes: ["frenzied"]
    });

    expect(resolveMonsterBaseMoveSpeedWithAffixes(100, ["frenzied"])).toBe(frenzied.moveSpeed);
    expect(resolveMonsterBaseMoveSpeedWithAffixes(100, [])).toBe(100);
  });

  it("applies vampiric leech from dealt damage with max health clamp", () => {
    const result = resolveMonsterAffixOnDealDamage(
      {
        ...baseMonster(),
        health: 90,
        maxHealth: 100,
        affixes: ["vampiric"]
      },
      "player",
      50,
      1234
    );
    expect(result.monster.health).toBe(100);
    expect(result.leechEvent).toEqual({
      monsterId: "m1",
      targetId: "player",
      amount: 10,
      timestampMs: 1234
    });
  });

  it("creates split children via unified onKilled hook", () => {
    const result = resolveMonsterAffixOnKilled(
      {
        ...baseMonster(),
        affixes: ["splitting", "vampiric"]
      },
      999
    );
    expect(result.children).toHaveLength(2);
    expect(result.children[0]?.affixes).toEqual(["vampiric"]);
    expect(result.children[0]?.dropTableId).toBe("");
    expect(result.children[0]?.health).toBe(Math.floor(baseMonster().maxHealth * 0.42));
    expect(result.splitEvent?.sourceMonsterId).toBe("m1");
    expect(result.splitEvent?.spawnedIds).toHaveLength(2);
  });
});
