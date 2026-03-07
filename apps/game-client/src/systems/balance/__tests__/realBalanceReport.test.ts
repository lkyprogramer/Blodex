import { describe, expect, it } from "vitest";
import { createRealBalanceReport, DEFAULT_BALANCE_DRIFT_THRESHOLDS } from "../RealBalanceReport";
import { resolveRealBalanceScenarioCalibration } from "../RealBalanceCalibration";

describe("real balance report", () => {
  it("prints heuristic vs real drift report and stays within thresholds", () => {
    const report = createRealBalanceReport(18);

    console.log("[balance:real-report] JSON");
    console.log(JSON.stringify(report, null, 2));

    for (const row of report.rows) {
      expect(row.breaches).toEqual([]);
    }

    expect(report.thresholds.clearRate).toBe(DEFAULT_BALANCE_DRIFT_THRESHOLDS.clearRate);
    expect(report.thresholds.clearRate).toBe(0.62);
    expect(report.rows.find((row) => row.name === "hard-average")?.calibrationId).toBe("phase6-6.5-hard-average-v2");
    expect(report.rows.find((row) => row.name === "hard-average")?.effectiveThresholds.clearRate).toBe(0.82);
    expect(report.rows.find((row) => row.name === "hard-average")?.effectiveThresholds.rareShare).toBe(0.11);
    expect(report.rows.find((row) => row.name === "hard-average")?.effectiveThresholds.avgRunDurationMs).toBe(180000);
    expect(report.rows.find((row) => row.name === "nightmare-optimal")?.calibrationId).toBe(
      "phase6-6.5-nightmare-optimal-v1"
    );
    expect(report.rows.find((row) => row.name === "nightmare-optimal")?.effectiveThresholds.avgRunDurationMs).toBe(320000);
    expect(report.rows.find((row) => row.name === "normal-average")?.effectiveThresholds.clearRate).toBe(0.62);
    expect(report.rows.find((row) => row.name === "normal-average")?.effectiveThresholds.rareShare).toBe(0.09);
  }, 15_000);

  it("only applies calibration when sample size matches the recorded baseline", () => {
    expect(resolveRealBalanceScenarioCalibration("hard-average", 18)?.id).toBe("phase6-6.5-hard-average-v2");
    expect(resolveRealBalanceScenarioCalibration("hard-average", 24)).toBeUndefined();
    expect(resolveRealBalanceScenarioCalibration("nightmare-optimal", 18)?.id).toBe(
      "phase6-6.5-nightmare-optimal-v1"
    );
  });
});
