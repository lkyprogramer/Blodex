import { describe, expect, it } from "vitest";
import {
  clampEndlessBlueprintDropBonus,
  endlessFloorClearBonus,
  endlessKillShardReward,
  recordEndlessBestFloor,
  resolveEndlessAffixBonusCount,
  resolveEndlessScalingMultiplier,
  toEndlessFloorConfig
} from "../endless";
import { createInitialMeta } from "../run";

describe("endless", () => {
  it("caps shard rewards per kill", () => {
    expect(endlessKillShardReward(1)).toBe(2);
    expect(endlessKillShardReward(10)).toBe(20);
    expect(endlessKillShardReward(99)).toBe(20);
  });

  it("uses low-slope floor clear bonus", () => {
    expect(endlessFloorClearBonus(6)).toBe(14);
    expect(endlessFloorClearBonus(12)).toBe(20);
  });

  it("applies scaling and affix thresholds", () => {
    expect(resolveEndlessScalingMultiplier(6)).toBeCloseTo(1.25);
    expect(resolveEndlessScalingMultiplier(8)).toBeCloseTo(1.75);
    expect(resolveEndlessAffixBonusCount(7)).toBe(0);
    expect(resolveEndlessAffixBonusCount(8)).toBe(1);
    expect(resolveEndlessAffixBonusCount(10)).toBe(2);
  });

  it("caps blueprint bonus and records best floor", () => {
    expect(clampEndlessBlueprintDropBonus(0.05)).toBe(0.05);
    expect(clampEndlessBlueprintDropBonus(0.6)).toBe(0.2);
    const meta = createInitialMeta();
    const updated = recordEndlessBestFloor(meta, 12);
    expect(updated.endlessBestFloor).toBe(12);
    expect(recordEndlessBestFloor(updated, 10).endlessBestFloor).toBe(12);
  });

  it("converts base floor config into endless config", () => {
    const endlessConfig = toEndlessFloorConfig(
      {
        floorNumber: 5,
        monsterHpMultiplier: 2,
        monsterDmgMultiplier: 1.6,
        monsterCount: 1,
        clearThreshold: 1,
        isBossFloor: true
      },
      8
    );
    expect(endlessConfig.floorNumber).toBe(8);
    expect(endlessConfig.isBossFloor).toBe(false);
    expect(endlessConfig.monsterHpMultiplier).toBeGreaterThan(2);
  });
});
