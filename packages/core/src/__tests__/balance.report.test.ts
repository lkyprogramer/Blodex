import { describe, expect, it } from "vitest";
import { createBalanceReport } from "../balanceReport";

describe("balance report", () => {
  it("prints stable JSON report for tuning snapshots", () => {
    const report = createBalanceReport(240);
    const byName = new Map(report.rows.map((row) => [row.name, row]));

    expect(report.rows).toHaveLength(4);
    expect(byName.get("normal-average")?.result.clearRate).toBeGreaterThanOrEqual(0.4);
    expect(byName.get("normal-average")?.result.clearRate).toBeLessThanOrEqual(0.6);
    expect(byName.get("hard-optimal")?.result.clearRate).toBeGreaterThanOrEqual(0.6);
    expect(byName.get("hard-optimal")?.result.clearRate).toBeLessThanOrEqual(0.8);

    console.log("[balance:report] JSON");
    console.log(JSON.stringify(report, null, 2));
  });
});
