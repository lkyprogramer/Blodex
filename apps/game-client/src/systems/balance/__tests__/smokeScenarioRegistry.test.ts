import { describe, expect, it } from "vitest";
import {
  PHASE6_SMOKE_SCENARIO_REGISTRY,
  derivePhase6SmokeMatrix
} from "../Phase6EvidenceRegistry";
import { createPhase6EvidencePack } from "../Phase6EvidencePack";

describe("phase6 smoke scenario registry", () => {
  it("derives automation and manual smoke statuses from assessments and artifacts", () => {
    const pack = createPhase6EvidencePack(18);
    const smokeMatrix = derivePhase6SmokeMatrix(pack.pacingAssessments);

    expect(PHASE6_SMOKE_SCENARIO_REGISTRY).toHaveLength(7);
    expect(smokeMatrix.find((entry) => entry.id === "S6-01")?.status).toBe("pass");
    expect(smokeMatrix.find((entry) => entry.id === "S6-02")?.status).toBe("pass");
    expect(smokeMatrix.find((entry) => entry.id === "S6-03")?.status).toBe("fail");
    expect(smokeMatrix.find((entry) => entry.id === "S6-04")?.status).toBe("pass");
    expect(smokeMatrix.find((entry) => entry.id === "S6-05")?.status).toBe("pending");
    expect(smokeMatrix.find((entry) => entry.id === "S6-06")?.status).toBe("pass");
    expect(smokeMatrix.find((entry) => entry.id === "S6-07")?.status).toBe("pending");
  });
});
