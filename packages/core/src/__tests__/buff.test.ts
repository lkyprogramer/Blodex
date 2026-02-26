import { describe, expect, it } from "vitest";
import { aggregateBuffEffects, applyBuff, updateBuffs } from "../buff";
import type { BuffDef, BuffInstance } from "../contracts/types";

const defs: Record<string, BuffDef> = {
  war_cry: {
    id: "war_cry",
    name: "War Cry",
    duration: 6000,
    statModifiers: { attackPower: 12 },
    statMultipliers: { attackSpeed: 1.2 }
  },
  frost_slow: {
    id: "frost_slow",
    name: "Frost Slow",
    duration: 3000,
    slow: 0.5
  }
};

const instance: BuffInstance = {
  defId: "war_cry",
  sourceId: "p",
  targetId: "p",
  appliedAtMs: 0,
  expiresAtMs: 6000
};

describe("buff", () => {
  it("applies and expires buff", () => {
    const applied = applyBuff([], instance);
    expect(applied).toHaveLength(1);

    const active = updateBuffs(applied, 3000);
    expect(active.active).toHaveLength(1);

    const expired = updateBuffs(applied, 7000);
    expect(expired.expired).toHaveLength(1);
  });

  it("aggregates additive and multiplier effects", () => {
    const effects = aggregateBuffEffects(
      [
        instance,
        { defId: "frost_slow", sourceId: "x", targetId: "p", appliedAtMs: 0, expiresAtMs: 3000 }
      ],
      defs
    );
    expect(effects.additive.attackPower).toBe(12);
    expect(effects.multiplicative.attackSpeed).toBe(1.2);
    expect(effects.slowMultiplier).toBe(0.5);
  });
});
