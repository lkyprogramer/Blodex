import { describe, expect, it } from "vitest";
import { createRealBalanceReport, DEFAULT_BALANCE_DRIFT_THRESHOLDS } from "../RealBalanceReport";

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
    expect(report.rows.find((row) => row.name === "hard-average")?.effectiveThresholds.clearRate).toBe(0.68);
    expect(report.rows.find((row) => row.name === "normal-average")?.effectiveThresholds.clearRate).toBe(0.62);
  }, 15_000);
});
