import { describe, expect, it } from "vitest";
import { calculateObolReward, calculateSoulShardReward, migrateMeta, purchaseUnlock } from "../meta";
import type { UnlockDef } from "../contracts/types";
import type { RunState } from "../run";

describe("meta", () => {
  it("migrates v1 to v2 schema", () => {
    const migrated = migrateMeta({ runsPlayed: 3, bestFloor: 2, bestTimeMs: 12345 });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.runsPlayed).toBe(3);
    expect(migrated.soulShards).toBe(0);
  });

  it("calculates rewards", () => {
    const run: RunState = {
      startedAtMs: 0,
      runSeed: "seed",
      currentFloor: 5,
      floor: 5,
      floorsCleared: 4,
      kills: 12,
      totalKills: 30,
      lootCollected: 7,
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
