export type BalanceDriftMetricName =
  | "clearRate"
  | "avgFloorReached"
  | "rareShare"
  | "avgRunDurationMs";

export interface BalanceDriftCalibrationRecord {
  id: string;
  scenarioName: string;
  sourceSampleSize: number;
  baselineCommit: string;
  rationale: string;
  observedDelta: Partial<Record<BalanceDriftMetricName, number>>;
  guardBand: Partial<Record<BalanceDriftMetricName, number>>;
  thresholds: Partial<Record<BalanceDriftMetricName, number>>;
}

export const PHASE6_BALANCE_BASELINE_COMMIT = "19574b7";

export const DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS: Record<string, BalanceDriftCalibrationRecord> = {
  "hard-average": {
    id: "phase6-6.5-hard-average-v2",
    scenarioName: "hard-average",
    sourceSampleSize: 18,
    baselineCommit: PHASE6_BALANCE_BASELINE_COMMIT,
    rationale:
      "6.5 added floor-level pacing overhead to both heuristic and real simulators; hard-average still diverges on avgRunDurationMs and requires a scenario-scoped guard band.",
    observedDelta: {
      clearRate: 0.7222,
      rareShare: 0.0888,
      avgRunDurationMs: 159_531
    },
    guardBand: {
      clearRate: 0.0978,
      rareShare: 0.0212,
      avgRunDurationMs: 20_469
    },
    thresholds: {
      clearRate: 0.82,
      rareShare: 0.11,
      avgRunDurationMs: 180_000
    }
  },
  "nightmare-optimal": {
    id: "phase6-6.5-nightmare-optimal-v1",
    scenarioName: "nightmare-optimal",
    sourceSampleSize: 18,
    baselineCommit: PHASE6_BALANCE_BASELINE_COMMIT,
    rationale:
      "6.5 pacing overhead exposes a larger heuristic-vs-real duration gap on nightmare-optimal; keep it isolated to this scenario instead of widening the global default.",
    observedDelta: {
      avgRunDurationMs: 296_862
    },
    guardBand: {
      avgRunDurationMs: 23_138
    },
    thresholds: {
      avgRunDurationMs: 320_000
    }
  }
};

export function resolveRealBalanceScenarioCalibration(
  scenarioName: string,
  sampleSize: number
): BalanceDriftCalibrationRecord | undefined {
  const calibration = DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS[scenarioName];
  if (calibration === undefined) {
    return undefined;
  }
  return calibration.sourceSampleSize === Math.max(1, Math.floor(sampleSize)) ? calibration : undefined;
}
