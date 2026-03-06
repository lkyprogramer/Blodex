import {
  DEFAULT_BALANCE_REPORT_SCENARIOS,
  simulateRun,
  type BalanceReportScenario,
  type RunSimulation
} from "@blodex/core";
import { simulateRealRun } from "./RealBalanceSimulator";

export interface BalanceDriftThresholds {
  clearRate: number;
  avgFloorReached: number;
  rareShare: number;
  avgRunDurationMs: number;
}

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
  heuristic: RunSimulation;
  real: RunSimulation;
  delta: BalanceDriftDelta;
  breaches: string[];
}

export interface RealBalanceReport {
  generatedAt: string;
  sampleSize: number;
  thresholds: BalanceDriftThresholds;
  rows: BalanceDriftRow[];
}

export const DEFAULT_BALANCE_DRIFT_THRESHOLDS: BalanceDriftThresholds = {
  clearRate: 0.62,
  avgFloorReached: 1.75,
  rareShare: 0.09,
  avgRunDurationMs: 150_000
};

function absoluteDelta(left: number, right: number): number {
  return Number(Math.abs(left - right).toFixed(4));
}

export function createBalanceDriftRow(
  scenario: BalanceReportScenario,
  sampleSize: number,
  thresholds: BalanceDriftThresholds = DEFAULT_BALANCE_DRIFT_THRESHOLDS
): BalanceDriftRow {
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
  if (delta.clearRate > thresholds.clearRate) {
    breaches.push(`clearRate>${thresholds.clearRate}`);
  }
  if (delta.avgFloorReached > thresholds.avgFloorReached) {
    breaches.push(`avgFloorReached>${thresholds.avgFloorReached}`);
  }
  if (delta.rareShare > thresholds.rareShare) {
    breaches.push(`rareShare>${thresholds.rareShare}`);
  }
  if (delta.avgRunDurationMs > thresholds.avgRunDurationMs) {
    breaches.push(`avgRunDurationMs>${thresholds.avgRunDurationMs}`);
  }

  return {
    name: scenario.name,
    sampleSize,
    seedBase,
    heuristic,
    real,
    delta,
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
