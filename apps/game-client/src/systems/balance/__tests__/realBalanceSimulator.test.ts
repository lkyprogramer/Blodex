import { describe, expect, it } from "vitest";
import { simulateRealRun } from "../RealBalanceSimulator";

describe("simulateRealRun", () => {
  it("is deterministic for the same input", () => {
    const config = {
      difficulty: "hard" as const,
      playerBehavior: "average" as const,
      sampleSize: 8,
      seedBase: "real-balance-deterministic"
    };

    const first = simulateRealRun(config);
    const second = simulateRealRun(config);

    expect(first).toEqual(second);
  });

  it("produces a stable shape with bounded rarity ratios", () => {
    const report = simulateRealRun({
      difficulty: "normal",
      playerBehavior: "average",
      sampleSize: 8,
      seedBase: "real-balance-shape"
    });

    expect(report.clearRate).toBeGreaterThanOrEqual(0);
    expect(report.clearRate).toBeLessThanOrEqual(1);
    expect(report.hpCurveP50).toHaveLength(5);
    expect(report.itemRarityDistribution.rare).toBeGreaterThanOrEqual(0);
    expect(report.itemRarityDistribution.rare).toBeLessThanOrEqual(1);
    expect(report.combatRhythm?.avgSkillUsesPerRun ?? 0).toBeGreaterThan(0);
    expect(report.combatRhythm?.avgSkillCastsPer30s ?? 0).toBeGreaterThan(0);
    expect(report.combatRhythm?.avgSkillDamageShare ?? 0).toBeGreaterThanOrEqual(0);
    expect(report.combatRhythm?.avgAutoAttackDamageShare ?? 0).toBeGreaterThanOrEqual(0);
  });
});
