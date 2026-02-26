import { describe, expect, it } from "vitest";
import type { MetaProgression, UnlockDef } from "../contracts/types";
import { canPurchaseUnlock, purchaseUnlock } from "../meta";
import { createInitialMeta } from "../run";

function makeUnlock(overrides: Partial<UnlockDef> = {}): UnlockDef {
  return {
    id: "u_test_unlock",
    name: "Test Unlock",
    description: "Test unlock description.",
    tier: 1,
    cost: 10,
    cumulativeRequirement: 0,
    effect: {
      type: "permanent_upgrade",
      key: "startingHealth",
      value: 5
    },
    ...overrides
  };
}

describe("meta unlock purchasing", () => {
  it("blocks purchases when cumulative unlock progress requirement is not met", () => {
    const meta: MetaProgression = {
      ...createInitialMeta(),
      soulShards: 999,
      cumulativeUnlockProgress: 49
    };
    const gatedUnlock = makeUnlock({ cumulativeRequirement: 50, cost: 30 });

    expect(canPurchaseUnlock(meta, gatedUnlock)).toBe(false);
    expect(purchaseUnlock(meta, gatedUnlock)).toEqual(meta);
  });

  it("allows gated unlocks when progress is met and increments cumulative progress", () => {
    const meta: MetaProgression = {
      ...createInitialMeta(),
      soulShards: 200,
      cumulativeUnlockProgress: 50
    };
    const gatedUnlock = makeUnlock({ id: "u_skill_slot_3", cumulativeRequirement: 50, cost: 30 });

    const next = purchaseUnlock(meta, gatedUnlock);

    expect(next.unlocks).toContain(gatedUnlock.id);
    expect(next.soulShards).toBe(170);
    expect(next.cumulativeUnlockProgress).toBe(80);
  });
});
