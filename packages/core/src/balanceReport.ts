import { simulateRun, type BalanceConfig, type RunSimulation } from "./balance";
import { DEFAULT_STORY_MAX_FLOOR, PHASE6_BASELINE_MAX_FLOOR } from "./storyRun";

export interface BalanceReportScenario {
  name: string;
  config: Omit<BalanceConfig, "sampleSize" | "seedBase">;
}

export interface BalanceReportRow {
  name: string;
  sampleSize: number;
  seedBase: string;
  result: RunSimulation;
}

export interface BalanceReport {
  generatedAt: string;
  sampleSize: number;
  rows: BalanceReportRow[];
}

export const DEFAULT_BALANCE_REPORT_SCENARIOS: readonly BalanceReportScenario[] = [
  {
    name: "normal-average",
    config: {
      difficulty: "normal",
      playerBehavior: "average",
      maxFloors: PHASE6_BASELINE_MAX_FLOOR
    }
  },
  {
    name: "hard-optimal",
    config: {
      difficulty: "hard",
      playerBehavior: "optimal",
      maxFloors: PHASE6_BASELINE_MAX_FLOOR
    }
  },
  {
    name: "hard-average",
    config: {
      difficulty: "hard",
      playerBehavior: "average",
      maxFloors: PHASE6_BASELINE_MAX_FLOOR
    }
  },
  {
    name: "nightmare-optimal",
    config: {
      difficulty: "nightmare",
      playerBehavior: "optimal",
      maxFloors: PHASE6_BASELINE_MAX_FLOOR
    }
  }
] as const;

export const PHASE7_LONG_RUN_REPORT_SCENARIOS: readonly BalanceReportScenario[] = [
  {
    name: "longrun-normal-average",
    config: {
      difficulty: "normal",
      playerBehavior: "average",
      maxFloors: DEFAULT_STORY_MAX_FLOOR
    }
  },
  {
    name: "longrun-hard-average",
    config: {
      difficulty: "hard",
      playerBehavior: "average",
      maxFloors: DEFAULT_STORY_MAX_FLOOR
    }
  },
  {
    name: "longrun-nightmare-optimal",
    config: {
      difficulty: "nightmare",
      playerBehavior: "optimal",
      maxFloors: DEFAULT_STORY_MAX_FLOOR
    }
  }
] as const;

export function createBalanceReport(
  sampleSize: number,
  scenarios: readonly BalanceReportScenario[] = DEFAULT_BALANCE_REPORT_SCENARIOS
): BalanceReport {
  const normalizedSampleSize = Math.max(1, Math.floor(sampleSize));
  const rows: BalanceReportRow[] = scenarios.map((scenario) => {
    const seedBase = `phase3-${scenario.name}`;
    return {
      name: scenario.name,
      sampleSize: normalizedSampleSize,
      seedBase,
      result: simulateRun({
        ...scenario.config,
        sampleSize: normalizedSampleSize,
        seedBase
      })
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: normalizedSampleSize,
    rows
  };
}
