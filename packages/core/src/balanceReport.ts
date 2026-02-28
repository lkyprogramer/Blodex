import { simulateRun, type BalanceConfig, type RunSimulation } from "./balance";

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
      playerBehavior: "average"
    }
  },
  {
    name: "hard-optimal",
    config: {
      difficulty: "hard",
      playerBehavior: "optimal"
    }
  },
  {
    name: "hard-average",
    config: {
      difficulty: "hard",
      playerBehavior: "average"
    }
  },
  {
    name: "nightmare-optimal",
    config: {
      difficulty: "nightmare",
      playerBehavior: "optimal"
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
