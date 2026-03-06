import { describe, expect, it } from "vitest";
import { createRealBalanceReport } from "../RealBalanceReport";

describe("real balance report", () => {
  it("prints heuristic vs real drift report and stays within thresholds", () => {
    const report = createRealBalanceReport(18);

    console.log("[balance:real-report] JSON");
    console.log(JSON.stringify(report, null, 2));

    for (const row of report.rows) {
      expect(row.breaches).toEqual([]);
    }
  });
});
