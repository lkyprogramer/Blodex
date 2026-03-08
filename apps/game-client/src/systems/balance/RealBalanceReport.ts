import {
  DEFAULT_BALANCE_REPORT_SCENARIOS,
  simulateRun,
  type BalanceReportScenario,
  type RunSimulation
} from "@blodex/core";
import {
  DEFAULT_BALANCE_DRIFT_THRESHOLDS,
  resolveEffectivePhase6DriftThresholds,
  type BalanceDriftThresholds
} from "./BalanceThresholdGovernance";
import { simulateRealRun } from "./RealBalanceSimulator";

export { DEFAULT_BALANCE_DRIFT_THRESHOLDS };
export type { BalanceDriftThresholds };

export interface BalanceDriftDelta {
  clearRate: number;
  avgFloorReached: number;
  rareShare: number;
  avgRunDurationMs: number;
}

export interface BalanceDriftRow {
  name: string;
  sampleSize: number;
  seedBase: string;
  calibrationId?: string;
  heuristic: RunSimulation;
  real: RunSimulation;
  delta: BalanceDriftDelta;
  effectiveThresholds: BalanceDriftThresholds;
  breaches: string[];
}

export interface RealBalanceReport {
  generatedAt: string;
  sampleSize: number;
  thresholds: BalanceDriftThresholds;
  rows: BalanceDriftRow[];
}

function absoluteDelta(left: number, right: number): number {
  return Number(Math.abs(left - right).toFixed(4));
}

export function createBalanceDriftRow(
  scenario: BalanceReportScenario,
  sampleSize: number,
  thresholds: BalanceDriftThresholds = DEFAULT_BALANCE_DRIFT_THRESHOLDS
): BalanceDriftRow {
  const governance = resolveEffectivePhase6DriftThresholds(scenario.name, sampleSize);
  const effectiveThresholds: BalanceDriftThresholds = {
    ...governance.policyThresholds,
    ...thresholds,
    ...(governance.overrideThresholds ?? {})
  };
  const seedBase = `phase5-real-${scenario.name}`;
  const heuristic = simulateRun({
    ...scenario.config,
    sampleSize,
    seedBase
  });
  const real = simulateRealRun({
    ...scenario.config,
    sampleSize,
    seedBase
  });
  const delta: BalanceDriftDelta = {
    clearRate: absoluteDelta(heuristic.clearRate, real.clearRate),
    avgFloorReached: absoluteDelta(heuristic.avgFloorReached, real.avgFloorReached),
    rareShare: absoluteDelta(
      heuristic.itemRarityDistribution.rare ?? 0,
      real.itemRarityDistribution.rare ?? 0
    ),
    avgRunDurationMs: Math.abs(heuristic.avgRunDurationMs - real.avgRunDurationMs)
  };
  const breaches: string[] = [];
  if (delta.clearRate > effectiveThresholds.clearRate) {
    breaches.push(`clearRate>${effectiveThresholds.clearRate}`);
  }
  if (delta.avgFloorReached > effectiveThresholds.avgFloorReached) {
    breaches.push(`avgFloorReached>${effectiveThresholds.avgFloorReached}`);
  }
  if (delta.rareShare > effectiveThresholds.rareShare) {
    breaches.push(`rareShare>${effectiveThresholds.rareShare}`);
  }
  if (delta.avgRunDurationMs > effectiveThresholds.avgRunDurationMs) {
    breaches.push(`avgRunDurationMs>${effectiveThresholds.avgRunDurationMs}`);
  }

  return {
    name: scenario.name,
    sampleSize,
    seedBase,
    ...(governance.calibration === undefined ? {} : { calibrationId: governance.calibration.id }),
    heuristic,
    real,
    delta,
    effectiveThresholds,
    breaches
  };
}

export function createRealBalanceReport(
  sampleSize: number,
  scenarios: readonly BalanceReportScenario[] = DEFAULT_BALANCE_REPORT_SCENARIOS,
  thresholds: BalanceDriftThresholds = DEFAULT_BALANCE_DRIFT_THRESHOLDS
): RealBalanceReport {
  const normalizedSampleSize = Math.max(1, Math.floor(sampleSize));
  return {
    generatedAt: new Date().toISOString(),
    sampleSize: normalizedSampleSize,
    thresholds,
    rows: scenarios.map((scenario) => createBalanceDriftRow(scenario, normalizedSampleSize, thresholds))
  };
}
