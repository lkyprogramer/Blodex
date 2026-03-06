export type BalanceDriftMetricName =
  | "clearRate"
  | "avgFloorReached"
  | "rareShare"
  | "avgRunDurationMs";

export interface BalanceDriftCalibrationRecord {
  id: string;
  scenarioName: string;
  sourceSampleSize: number;
  rationale: string;
  observedDelta: Partial<Record<BalanceDriftMetricName, number>>;
  guardBand: Partial<Record<BalanceDriftMetricName, number>>;
  thresholds: Partial<Record<BalanceDriftMetricName, number>>;
}

export const DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS: Record<string, BalanceDriftCalibrationRecord> = {
  "hard-average": {
    id: "phase6-6.1-hard-average-v1",
    scenarioName: "hard-average",
    sourceSampleSize: 18,
    rationale:
      "6.1 connected passive mana regen and buff/debuff runtime in the real simulator, which widened the heuristic-vs-real gap for hard-average only.",
    observedDelta: {
      clearRate: 0.7777,
      rareShare: 0.0968
    },
    guardBand: {
      clearRate: 0.0423,
      rareShare: 0.0132
    },
    thresholds: {
      clearRate: 0.82,
      rareShare: 0.11
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
