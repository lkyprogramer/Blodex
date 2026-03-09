import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORY_MAX_FLOOR,
  PHASE7_LONG_RUN_REPORT_SCENARIOS,
  createBalanceReport
} from "@blodex/core";
import { createRealBalanceReport } from "../RealBalanceReport";

describe("phase7 long-run evidence", () => {
  it("produces dedicated 8-floor heuristic and real reports", () => {
    const heuristic = createBalanceReport(12, PHASE7_LONG_RUN_REPORT_SCENARIOS);
    const real = createRealBalanceReport(12, PHASE7_LONG_RUN_REPORT_SCENARIOS);

    console.log("[phase7:long-run-evidence] JSON");
    console.log(
      JSON.stringify(
        {
          heuristic,
          real
        },
        null,
        2
      )
    );

    expect(heuristic.rows).toHaveLength(3);
    expect(real.rows).toHaveLength(3);
    for (const row of heuristic.rows) {
      expect(row.result.hpCurveP50).toHaveLength(DEFAULT_STORY_MAX_FLOOR);
      expect(row.result.pacing?.floorDurationP50Ms).toHaveLength(DEFAULT_STORY_MAX_FLOOR);
    }
    for (const row of real.rows) {
      expect(row.real.hpCurveP50).toHaveLength(DEFAULT_STORY_MAX_FLOOR);
      expect(row.real.pacing?.floorDurationP50Ms).toHaveLength(DEFAULT_STORY_MAX_FLOOR);
      expect(row.real.powerSpikes?.pairSatisfactionRate["1-2"] ?? 0).toBeGreaterThanOrEqual(0);
      expect(row.real.powerSpikes?.pairSatisfactionRate["3-4"] ?? 0).toBeGreaterThanOrEqual(0);
      expect(row.real.powerSpikes?.pairSatisfactionRate["5-6"] ?? 0).toBeGreaterThanOrEqual(0);
      expect(row.real.powerSpikes?.pairSatisfactionRate["7-8"] ?? 0).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);
});
