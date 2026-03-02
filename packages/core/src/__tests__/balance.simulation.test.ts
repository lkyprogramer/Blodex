import { describe, expect, it } from "vitest";
import { simulateRun } from "../balance";

describe("balance simulation", () => {
  it("is deterministic for same config and seed", () => {
    const config = {
      difficulty: "normal" as const,
      playerBehavior: "average" as const,
      sampleSize: 140,
      seedBase: "deterministic-sim"
    };

    const first = simulateRun(config);
    const second = simulateRun(config);
    expect(first).toEqual(second);
  });

  it("keeps target clear-rate ranges for baseline gates", () => {
    const averageNormal = simulateRun({
      difficulty: "normal",
      playerBehavior: "average",
      sampleSize: 240,
      seedBase: "gate-normal-average"
    });
    expect(averageNormal.clearRate).toBeGreaterThanOrEqual(0.4);
    expect(averageNormal.clearRate).toBeLessThanOrEqual(0.6);

    const optimalHard = simulateRun({
      difficulty: "hard",
      playerBehavior: "optimal",
      sampleSize: 240,
      seedBase: "gate-hard-optimal"
    });
    expect(optimalHard.clearRate).toBeGreaterThanOrEqual(0.6);
    expect(optimalHard.clearRate).toBeLessThanOrEqual(0.8);
  });
});
