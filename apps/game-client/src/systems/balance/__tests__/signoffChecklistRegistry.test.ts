import { describe, expect, it } from "vitest";
import { derivePhase6SignoffChecklist } from "../Phase6EvidenceRegistry";
import { createPhase6EvidencePack } from "../Phase6EvidencePack";

describe("phase6 signoff checklist registry", () => {
  it("derives checklist statuses from smoke, thresholds, and artifact-backed manual evidence", () => {
    const pack = createPhase6EvidencePack(18);
    const checklist = derivePhase6SignoffChecklist(
      pack.pacingAssessments,
      pack.thresholdAudit,
      pack.smokeMatrix
    );

    expect(checklist.find((entry) => entry.id === "timing-normal-p50")?.status).toBe("pass");
    expect(checklist.find((entry) => entry.id === "threshold-audit")?.status).toBe("pass");
    expect(checklist.find((entry) => entry.id === "skill-cadence")?.status).toBe("pass");
    expect(checklist.find((entry) => entry.id === "manual-smoke")?.status).toBe("pass");
    expect(checklist.find((entry) => entry.id === "taste-signoff")?.status).toBe("pass");
  }, 20_000);
});
