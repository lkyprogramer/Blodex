import { describe, expect, it } from "vitest";
import {
  PHASE6_SIGNOFF_CHECKLIST_REGISTRY,
  PHASE6_SMOKE_SCENARIO_REGISTRY,
  auditThresholdRegistry,
  buildPhase6PacingScenarioMap,
  buildPhase6ThresholdRegistry,
  createPhase6CalibrationRegistry
} from "../Phase6EvidenceRegistry";
import { getPhase6ReleaseArtifact } from "../Phase6ReleaseArtifactIndex";

describe("phase6 evidence registry integrity", () => {
  it("builds calibrations and thresholds against artifact-backed evidence", () => {
    const calibrationRegistry = createPhase6CalibrationRegistry();
    const thresholdRegistry = buildPhase6ThresholdRegistry(calibrationRegistry);
    const audit = auditThresholdRegistry(thresholdRegistry);

    expect(Object.keys(calibrationRegistry)).toEqual(["hard-average", "nightmare-optimal"]);
    expect(audit.passed).toBe(true);
    expect(thresholdRegistry.find((entry) => entry.scope === "global_default")?.baselineCommit).toBe("19574b7");
    for (const entry of thresholdRegistry) {
      expect(getPhase6ReleaseArtifact(entry.evidenceArtifactId)).toBeDefined();
    }
  });

  it("keeps smoke and signoff registries aligned on ids", () => {
    const smokeIds = new Set(PHASE6_SMOKE_SCENARIO_REGISTRY.map((entry) => entry.id));
    const manualSmoke = PHASE6_SIGNOFF_CHECKLIST_REGISTRY.find((entry) => entry.id === "manual-smoke");
    const pacingScenarioMap = buildPhase6PacingScenarioMap();

    expect(smokeIds).toEqual(new Set(["S6-01", "S6-02", "S6-03", "S6-04", "S6-05", "S6-06", "S6-07"]));
    expect(pacingScenarioMap).toEqual({
      normal: "normal-average",
      hard: "hard-average",
      nightmare: "nightmare-optimal"
    });
    expect(manualSmoke?.derivation).toBe("manual-smoke");
    if (manualSmoke?.derivation === "manual-smoke") {
      expect(new Set(manualSmoke.smokeScenarioIds)).toEqual(new Set(["S6-04", "S6-05", "S6-06", "S6-07"]));
    }
  });
});
