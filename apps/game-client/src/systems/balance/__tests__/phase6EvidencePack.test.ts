import { describe, expect, it } from "vitest";
import { createPhase6EvidencePack } from "../Phase6EvidencePack";

describe("phase6 evidence pack", () => {
  it("prints unified pacing, threshold, and sign-off evidence", () => {
    const pack = createPhase6EvidencePack(18);

    console.log("[phase6:evidence-pack] JSON");
    console.log(JSON.stringify(pack, null, 2));

    expect(pack.thresholdAudit.passed).toBe(true);
    expect(pack.thresholdRegistry.find((entry) => entry.scope === "global_default")?.baselineCommit).toBe("19574b7");
    expect(pack.thresholdRegistry.find((entry) => entry.id === "phase6-6.5-hard-average-v2")?.baselineCommit).toBe(
      "19574b7"
    );
    expect(pack.pacingAssessments.normal.floorChecks).toHaveLength(5);
    expect(pack.pacingAssessments.hard.skillCastsPer30s).toBeCloseTo(4.384, 3);
    expect(pack.smokeMatrix).toHaveLength(7);
    expect(pack.smokeMatrix.find((entry) => entry.id === "S6-02")?.status).toBe("pass");
    expect(pack.smokeMatrix.find((entry) => entry.id === "S6-03")?.status).toBe("fail");
    expect(pack.signoffChecklist.some((item) => item.id === "timing-normal-p50")).toBe(true);
    expect(pack.signoffChecklist.some((item) => item.id === "skill-cadence")).toBe(true);
    expect(pack.signoffChecklist.some((item) => item.id === "taste-signoff")).toBe(true);
    expect(pack.releaseClosure.knownIssues.some((issue) => issue.includes("active combat cadence"))).toBe(true);
  }, 20_000);
});
