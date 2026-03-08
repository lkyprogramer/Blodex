import {
  DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS,
  PHASE6_BALANCE_BASELINE_COMMIT,
  type BalanceDriftCalibrationRecord
} from "./RealBalanceCalibration";

export interface BalanceDriftThresholds {
  clearRate: number;
  avgFloorReached: number;
  rareShare: number;
  avgRunDurationMs: number;
}

export type BalanceCalibrationDiffClass =
  | "model_incomplete"
  | "sampling_mismatch"
  | "runtime_bug"
  | "content_drift";

export interface Phase6BalanceThresholdPolicy {
  id: string;
  scope: "global_default";
  baselineCommit: string;
  evidenceArtifactId: string;
  rationale: string;
  metricThresholds: BalanceDriftThresholds;
}

export interface Phase6BalanceCalibrationOverride extends BalanceDriftCalibrationRecord {
  scope: "scenario_override";
  diffClass: BalanceCalibrationDiffClass;
  sourceCommand: string;
  evidenceArtifactId: string;
  overrideAllowed: boolean;
}

export interface EffectiveBalanceThresholdResolution {
  policyThresholds: BalanceDriftThresholds;
  overrideThresholds?: Partial<BalanceDriftThresholds>;
  calibration?: Phase6BalanceCalibrationOverride;
}

export const DEFAULT_BALANCE_DRIFT_THRESHOLDS: BalanceDriftThresholds = {
  clearRate: 0.62,
  avgFloorReached: 1.75,
  rareShare: 0.09,
  avgRunDurationMs: 150_000
};

const PHASE6_OVERRIDE_DIFF_CLASSES: Record<string, BalanceCalibrationDiffClass> = {
  "hard-average": "sampling_mismatch",
  "nightmare-optimal": "model_incomplete"
};

export function createPhase6BalanceThresholdPolicy(): Phase6BalanceThresholdPolicy {
  return {
    id: "phase6-default-drift-thresholds",
    scope: "global_default",
    baselineCommit: PHASE6_BALANCE_BASELINE_COMMIT,
    evidenceArtifactId: "phase6-performance-compare-doc",
    rationale:
      "Phase 6 default drift thresholds are global policy guard rails and must not be widened without a scenario-scoped calibration record.",
    metricThresholds: { ...DEFAULT_BALANCE_DRIFT_THRESHOLDS }
  };
}

export function createPhase6BalanceCalibrationOverrides(): Record<string, Phase6BalanceCalibrationOverride> {
  return Object.fromEntries(
    Object.entries(DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS).map(([scenarioName, record]) => [
      scenarioName,
      {
        ...record,
        scope: "scenario_override",
        diffClass: PHASE6_OVERRIDE_DIFF_CLASSES[scenarioName] ?? "model_incomplete",
        sourceCommand: "pnpm balance:real:report && pnpm phase6:evidence:report",
        evidenceArtifactId: "phase6-performance-compare-doc",
        overrideAllowed: (PHASE6_OVERRIDE_DIFF_CLASSES[scenarioName] ?? "model_incomplete") !== "runtime_bug"
      }
    ])
  );
}

export function resolveEffectivePhase6DriftThresholds(
  scenarioName: string,
  sampleSize: number
): EffectiveBalanceThresholdResolution {
  const policy = createPhase6BalanceThresholdPolicy();
  const overrides = createPhase6BalanceCalibrationOverrides();
  const override = overrides[scenarioName];
  const normalizedSampleSize = Math.max(1, Math.floor(sampleSize));

  if (
    override === undefined ||
    !override.overrideAllowed ||
    override.sourceSampleSize !== normalizedSampleSize
  ) {
    return {
      policyThresholds: { ...policy.metricThresholds }
    };
  }

  return {
    policyThresholds: { ...policy.metricThresholds },
    overrideThresholds: { ...override.thresholds },
    calibration: override
  };
}
