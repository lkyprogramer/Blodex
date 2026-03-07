import { describe, expect, it } from "vitest";
import { PHASE6_PACING_TARGETS, assessPacingTargets } from "../Phase6Pacing";

describe("phase6 pacing", () => {
  it("freezes pacing targets for all story difficulties", () => {
    expect(PHASE6_PACING_TARGETS.normal.floorTargets).toHaveLength(5);
    expect(PHASE6_PACING_TARGETS.normal.runDurationP50RangeMs.min).toBe(12 * 60_000);
    expect(PHASE6_PACING_TARGETS.normal.runDurationP90MaxMs).toBe(20 * 60_000);
    expect(PHASE6_PACING_TARGETS.hard.floorTargets[0]?.monsterCount).toBe(12);
    expect(PHASE6_PACING_TARGETS.nightmare.floorTargets[4]?.revealThresholdKills).toBe(1);
  });

  it("marks alerts when pacing metrics drift outside targets", () => {
    const assessment = assessPacingTargets("normal", {
      clearRate: 0.5,
      avgFloorReached: 4.2,
      avgRunDurationMs: 900_000,
      hpCurveP50: [1, 1, 1, 1, 1],
      hpCurveP90: [1, 1, 1, 1, 1],
      deathCauseDistribution: {},
      itemRarityDistribution: { common: 0.6, magic: 0.3, rare: 0.1 },
      pacing: {
        runDurationP50Ms: 1_250_000,
        runDurationP90Ms: 1_300_000,
        floorDurationP50Ms: [90_000, 90_000, 90_000, 90_000, 90_000],
        floorDurationP90Ms: [90_000, 90_000, 90_000, 90_000, 90_000]
      },
      combatRhythm: {
        avgSkillUsesPerRun: 10,
        avgSkillCastsPer30s: 2,
        avgSkillDamageShare: 0.3,
        avgAutoAttackDamageShare: 0.7
      }
    });

    expect(assessment.runDurationP50WithinTarget).toBe(false);
    expect(assessment.runDurationP90WithinTarget).toBe(false);
    expect(assessment.skillCadenceWithinTarget).toBe(false);
    expect(assessment.alerts).toContain("run_duration_p50_out_of_range");
    expect(assessment.alerts).toContain("skill_cadence_out_of_range");
  });
});
