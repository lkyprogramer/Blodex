import { describe, expect, it } from "vitest";
import { createPhase6EvidencePack } from "../Phase6EvidencePack";
import { buildPhase6PacingScenarioMap } from "../Phase6EvidenceRegistry";

describe("phase6 evidence pack", () => {
  it("prints unified pacing, threshold, and sign-off evidence", () => {
    const pack = createPhase6EvidencePack(18);
    const pacingScenarioMap = buildPhase6PacingScenarioMap();

    console.log("[phase6:evidence-pack] JSON");
    console.log(JSON.stringify(pack, null, 2));

    expect(pack.calibrationRegistry).toHaveLength(2);
    expect(pack.thresholdAudit.passed).toBe(true);
    expect(pack.thresholdRegistry.find((entry) => entry.scope === "global_default")?.baselineCommit).toBe("19574b7");
    expect(pack.thresholdRegistry.find((entry) => entry.id === "phase7-7.7-hard-average-v1")?.baselineCommit).toBe(
      "19574b7"
    );
    expect(pack.releaseArtifactIndex.some((artifact) => artifact.id === "phase6-browser-smoke-report-doc")).toBe(true);
    expect(pack.smokeScenarioRegistry).toHaveLength(7);
    expect(pack.signoffChecklistRegistry.some((item) => item.id === "taste-signoff")).toBe(true);
    expect(pack.pacingAssessments.normal.floorChecks).toHaveLength(5);
    expect(pack.pacingAssessments.hard.skillCastsPer30s).toBeCloseTo(4.367, 3);
    expect(
      pack.smokeMatrix
        .filter((entry) => entry.evidenceType === "automation")
        .map((entry) => entry.evidence[0])
    ).toEqual([
      `normal:${pacingScenarioMap.normal}`,
      `hard:${pacingScenarioMap.hard}`,
      `nightmare:${pacingScenarioMap.nightmare}`
    ]);
    expect(pack.smokeMatrix).toHaveLength(7);
    expect(pack.smokeMatrix.find((entry) => entry.id === "S6-02")?.status).toBe("pass");
    expect(pack.smokeMatrix.find((entry) => entry.id === "S6-03")?.status).toBe("pass");
    expect(pack.smokeMatrix.find((entry) => entry.id === "S6-05")?.status).toBe("pass");
    expect(pack.smokeMatrix.find((entry) => entry.id === "S6-07")?.status).toBe("pass");
    expect(pack.signoffChecklist.some((item) => item.id === "timing-normal-p50")).toBe(true);
    expect(pack.signoffChecklist.some((item) => item.id === "skill-cadence")).toBe(true);
    expect(pack.signoffChecklist.some((item) => item.id === "taste-signoff")).toBe(true);
    expect(pack.releaseClosure.knownIssues.some((issue) => issue.includes("active combat cadence"))).toBe(false);
    expect(pack.signoffChecklist.find((item) => item.id === "manual-smoke")?.status).toBe("pass");
    expect(pack.signoffChecklist.find((item) => item.id === "taste-signoff")?.status).toBe("pass");
    expect(pack.releaseClosure.knownIssues).toEqual([]);
  }, 20_000);
});
