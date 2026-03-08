import { describe, expect, it } from "vitest";
import {
  createPhase6BalanceCalibrationOverrides,
  createPhase6BalanceThresholdPolicy,
  resolveEffectivePhase6DriftThresholds
} from "../BalanceThresholdGovernance";
import {
  auditThresholdRegistry,
  buildPhase6ThresholdRegistry,
  createPhase6CalibrationRegistry
} from "../Phase6EvidenceRegistry";

describe("threshold governance", () => {
  it("splits global policy from scenario overrides", () => {
    const policy = createPhase6BalanceThresholdPolicy();
    const overrides = createPhase6BalanceCalibrationOverrides();

    expect(policy.scope).toBe("global_default");
    expect(policy.id).toBe("phase6-default-drift-thresholds");
    expect(Object.keys(overrides)).toEqual(["hard-average", "nightmare-optimal"]);
    expect(overrides["hard-average"]?.diffClass).toBe("sampling_mismatch");
    expect(overrides["nightmare-optimal"]?.diffClass).toBe("model_incomplete");
    expect(overrides["hard-average"]?.overrideAllowed).toBe(true);
  });

  it("audits override metadata and rejects runtime bug overrides", () => {
    const entries = buildPhase6ThresholdRegistry(createPhase6CalibrationRegistry());
    const audit = auditThresholdRegistry(entries);

    expect(audit.passed).toBe(true);
    expect(audit.violations).toEqual([]);

    const invalidAudit = auditThresholdRegistry([
      ...entries.filter((entry) => entry.scope === "global_default"),
      {
        ...entries.find((entry) => entry.scope === "scenario_override" && entry.id === "phase6-6.5-hard-average-v2")!,
        diffClass: "runtime_bug"
      }
    ]);

    expect(invalidAudit.passed).toBe(false);
    expect(invalidAudit.violations).toContain("registry_override_runtime_bug_blocked:phase6-6.5-hard-average-v2");
  });

  it("applies only allowed scenario overrides through the governance resolver", () => {
    const hardAverage = resolveEffectivePhase6DriftThresholds("hard-average", 18);
    const unmatchedSampleSize = resolveEffectivePhase6DriftThresholds("hard-average", 24);

    expect(hardAverage.calibration?.id).toBe("phase6-6.5-hard-average-v2");
    expect(hardAverage.policyThresholds.clearRate).toBe(0.62);
    expect(hardAverage.overrideThresholds?.clearRate).toBe(0.82);
    expect(unmatchedSampleSize.calibration).toBeUndefined();
    expect(unmatchedSampleSize.policyThresholds.clearRate).toBe(0.62);
    expect(unmatchedSampleSize.overrideThresholds).toBeUndefined();
  });
});
