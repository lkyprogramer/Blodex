import { describe, expect, it } from "vitest";
import { applyRunSummaryToMeta, migrateMeta, purchaseUnlock } from "../meta";

describe("meta integration", () => {
  it("applies run rewards then purchases unlock", () => {
    const migrated = migrateMeta({ runsPlayed: 2, bestFloor: 2, bestTimeMs: 1000 });
    const rewarded = applyRunSummaryToMeta(migrated, {
      floorReached: 3,
      kills: 20,
      lootCollected: 8,
      elapsedMs: 60_000,
      leveledTo: 4,
      soulShardsEarned: 25
    });

    const next = purchaseUnlock(rewarded, {
      id: "unlock-1",
      name: "Slot",
      description: "",
      tier: 1,
      cost: 10,
      cumulativeRequirement: 0,
      effect: { type: "permanent_upgrade", key: "skillSlots", value: 1 }
    });

    expect(next.soulShards).toBe(15);
    expect(next.permanentUpgrades.skillSlots).toBe(migrateMeta({}).permanentUpgrades.skillSlots + 1);
  });
});
