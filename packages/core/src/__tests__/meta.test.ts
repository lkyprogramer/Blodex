import { describe, expect, it } from "vitest";
import type { MetaProgression, UnlockDef } from "../contracts/types";
import {
  calculateObolReward,
  calculateSoulShardReward,
  canPurchaseUnlock,
  migrateMeta,
  purchaseUnlock
} from "../meta";
import { getDifficultyModifier } from "../difficulty";
import type { RunState } from "../run";
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

describe("meta", () => {
  it("migrates v1/v2 data into v6 schema", () => {
    const migrated = migrateMeta({ runsPlayed: 3, bestFloor: 2, bestTimeMs: 12345 });
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.preferredLocale).toBeNull();
    expect(migrated.runsPlayed).toBe(3);
    expect(migrated.soulShards).toBe(0);
    expect(migrated.talentPoints).toEqual({});
    expect(migrated.totalShardsSpent).toBe(0);
    expect(migrated.blueprintFoundIds).toEqual([]);
    expect(migrated.selectedMutationIds).toEqual([]);
    expect(migrated.synergyDiscoveredIds).toEqual([]);
    expect(migrated.dailyHistory).toEqual([]);
  });

  it("keeps preferred locale when migrating v6 meta", () => {
    const migrated = migrateMeta({
      ...createInitialMeta(),
      schemaVersion: 6,
      preferredLocale: "zh-CN"
    });

    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.preferredLocale).toBe("zh-CN");
  });

  it("calculates rewards", () => {
    const run: RunState = {
      startedAtMs: 0,
      runSeed: "seed",
      difficulty: "normal",
      difficultyModifier: getDifficultyModifier("normal"),
      currentFloor: 5,
      currentBiomeId: "bone_throne",
      floor: 5,
      floorsCleared: 4,
      kills: 12,
      totalKills: 30,
      lootCollected: 7,
      challengeSuccessCount: 0,
      inEndless: false,
      endlessFloor: 0,
      runMode: "normal",
      runEconomy: { obols: 20 }
    };
    expect(calculateSoulShardReward(run, true)).toBeGreaterThan(0);
    expect(calculateObolReward("monster_kill")).toBe(1);
    expect(calculateObolReward("floor_clear")).toBe(5);
  });

  it("purchases unlock and applies permanent upgrade", () => {
    const meta = { ...migrateMeta({}), soulShards: 50 };
    const unlock: UnlockDef = {
      id: "u1",
      name: "HP",
      description: "",
      tier: 1,
      cost: 10,
      cumulativeRequirement: 0,
      effect: { type: "permanent_upgrade", key: "startingHealth", value: 10 }
    };
    const next = purchaseUnlock(meta, unlock);
    expect(next.soulShards).toBe(40);
    expect(next.permanentUpgrades.startingHealth).toBe(10);
  });
});

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
