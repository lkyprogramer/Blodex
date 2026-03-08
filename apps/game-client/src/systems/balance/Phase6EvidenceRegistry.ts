import type { DifficultyMode } from "@blodex/core";
import {
  createPhase6BalanceCalibrationOverrides,
  createPhase6BalanceThresholdPolicy,
  type BalanceCalibrationDiffClass,
  type BalanceDriftThresholds,
  type Phase6BalanceCalibrationOverride
} from "./BalanceThresholdGovernance";
import {
  getPhase6ReleaseArtifact,
  type Phase6ReleaseArtifactEntry
} from "./Phase6ReleaseArtifactIndex";
import type { PacingAssessment } from "./Phase6Pacing";

export type Phase6CalibrationRegistryEntry = Phase6BalanceCalibrationOverride;

export interface Phase6ThresholdRegistryEntry {
  scope: "global_default" | "scenario_override";
  id: string;
  metricThresholds: Partial<BalanceDriftThresholds>;
  scenarioName?: string;
  sourceSampleSize?: number;
  baselineCommit: string;
  evidenceArtifactId: string;
  rationale: string;
  diffClass?: BalanceCalibrationDiffClass;
}

export interface ThresholdAuditResult {
  passed: boolean;
  violations: string[];
}

export type Phase6SmokeScenarioStatus = "pass" | "pending" | "fail";

export type Phase6SmokeScenarioRegistryEntry =
  | {
      id: string;
      title: string;
      evidenceType: "automation";
      difficulty: DifficultyMode;
      scenarioName: string;
      assessmentSource: "pacing";
    }
  | {
      id: string;
      title: string;
      evidenceType: "manual";
      requiredArtifactIds: string[];
      completionPolicy: "all_present";
    };

export type Phase6AutomationSmokeScenarioRegistryEntry = Extract<
  Phase6SmokeScenarioRegistryEntry,
  { evidenceType: "automation" }
>;

export type Phase6SignoffRegistryEntry =
  | {
      id: string;
      title: string;
      derivation:
        | "timing-normal-p50"
        | "timing-normal-p90"
        | "timing-other-difficulties"
        | "skill-cadence"
        | "threshold-audit";
      evidenceArtifactIds: string[];
    }
  | {
      id: string;
      title: string;
      derivation: "manual-smoke";
      smokeScenarioIds: string[];
      evidenceArtifactIds: string[];
    }
  | {
      id: string;
      title: string;
      derivation: "artifact-presence";
      requiredArtifactIds: string[];
      evidenceArtifactIds: string[];
    };

export interface Phase6SmokeMatrixEntry {
  id: string;
  title: string;
  evidenceType: "automation" | "manual";
  status: Phase6SmokeScenarioStatus;
  evidence: string[];
}

export interface Phase6SignoffItem {
  id: string;
  title: string;
  status: "pass" | "pending" | "fail";
  evidence: string[];
}

function resolveArtifactPaths(artifactIds: readonly string[]): string[] {
  return artifactIds.flatMap((artifactId) => {
    const artifact = getPhase6ReleaseArtifact(artifactId);
    return artifact === undefined ? [] : [artifact.path];
  });
}

export function createPhase6CalibrationRegistry(): Record<string, Phase6CalibrationRegistryEntry> {
  return createPhase6BalanceCalibrationOverrides();
}

export function buildPhase6ThresholdRegistry(
  calibrations: Record<string, Phase6CalibrationRegistryEntry>
): Phase6ThresholdRegistryEntry[] {
  const policy = createPhase6BalanceThresholdPolicy();
  return [
    {
      scope: policy.scope,
      id: policy.id,
      metricThresholds: policy.metricThresholds,
      baselineCommit: policy.baselineCommit,
      evidenceArtifactId: policy.evidenceArtifactId,
      rationale: policy.rationale
    },
    ...Object.values(calibrations).map((record) => ({
      scope: "scenario_override" as const,
      id: record.id,
      metricThresholds: record.thresholds,
      scenarioName: record.scenarioName,
      sourceSampleSize: record.sourceSampleSize,
      baselineCommit: record.baselineCommit,
      evidenceArtifactId: record.evidenceArtifactId,
      rationale: record.rationale,
      diffClass: record.diffClass
    }))
  ];
}

export function auditThresholdRegistry(entries: readonly Phase6ThresholdRegistryEntry[]): ThresholdAuditResult {
  const violations: string[] = [];
  const defaultEntries = entries.filter((entry) => entry.scope === "global_default");
  if (defaultEntries.length !== 1) {
    violations.push("global_default_registry_count_invalid");
  }
  for (const entry of entries) {
    if (!entry.baselineCommit || !entry.rationale) {
      violations.push(`registry_metadata_incomplete:${entry.id}`);
    }
    if (getPhase6ReleaseArtifact(entry.evidenceArtifactId) === undefined) {
      violations.push(`registry_missing_evidence_artifact:${entry.id}`);
    }
    if (entry.scope === "scenario_override") {
      if (!entry.scenarioName) {
        violations.push(`registry_override_missing_scenario:${entry.id}`);
      }
      if ((entry.sourceSampleSize ?? 0) <= 0) {
        violations.push(`registry_override_missing_sample_size:${entry.id}`);
      }
      if (entry.diffClass === undefined) {
        violations.push(`registry_override_missing_diff_class:${entry.id}`);
      }
      if (entry.diffClass === "runtime_bug") {
        violations.push(`registry_override_runtime_bug_blocked:${entry.id}`);
      }
    }
  }
  return {
    passed: violations.length === 0,
    violations
  };
}

export const PHASE6_SMOKE_SCENARIO_REGISTRY: readonly Phase6SmokeScenarioRegistryEntry[] = [
  {
    id: "S6-01",
    title: "Normal story run",
    evidenceType: "automation",
    difficulty: "normal",
    scenarioName: "normal-average",
    assessmentSource: "pacing"
  },
  {
    id: "S6-02",
    title: "Hard story run",
    evidenceType: "automation",
    difficulty: "hard",
    scenarioName: "hard-average",
    assessmentSource: "pacing"
  },
  {
    id: "S6-03",
    title: "Nightmare story run",
    evidenceType: "automation",
    difficulty: "nightmare",
    scenarioName: "nightmare-optimal",
    assessmentSource: "pacing"
  },
  {
    id: "S6-04",
    title: "rare / build / boss 峰值 run",
    evidenceType: "manual",
    requiredArtifactIds: [
      "phase6-browser-smoke-report-doc",
      "phase6-browser-smoke-build-formed-shot",
      "phase6-browser-smoke-boss-reward-compare-shot"
    ],
    completionPolicy: "all_present"
  },
    {
      id: "S6-05",
      title: "三职业起步深度入口白盒样本",
      evidenceType: "manual",
      requiredArtifactIds: ["phase6-class-parity-video"],
      completionPolicy: "all_present"
    },
  {
    id: "S6-06",
    title: "trade-off item run",
    evidenceType: "manual",
    requiredArtifactIds: [
      "phase6-browser-smoke-report-doc",
      "phase6-browser-smoke-compare-prompt-shot"
    ],
    completionPolicy: "all_present"
  },
    {
      id: "S6-07",
      title: "buff / damageType / synergy 运行时入口与合同校验",
      evidenceType: "manual",
      requiredArtifactIds: ["phase6-buff-damagetype-video"],
      completionPolicy: "all_present"
    }
] as const;

export const PHASE6_SIGNOFF_CHECKLIST_REGISTRY: readonly Phase6SignoffRegistryEntry[] = [
  {
    id: "timing-normal-p50",
    title: "Normal 中位数 run 时长稳定在 12~18 min",
    derivation: "timing-normal-p50",
    evidenceArtifactIds: ["phase6-performance-compare-doc"]
  },
  {
    id: "timing-normal-p90",
    title: "Normal P90 <= 20 min",
    derivation: "timing-normal-p90",
    evidenceArtifactIds: ["phase6-performance-compare-doc"]
  },
  {
    id: "timing-other-difficulties",
    title: "Hard / Nightmare pacing assessment 已生成",
    derivation: "timing-other-difficulties",
    evidenceArtifactIds: ["phase6-performance-compare-doc"]
  },
  {
    id: "skill-cadence",
    title: "core skill cadence（active combat window）达标",
    derivation: "skill-cadence",
    evidenceArtifactIds: ["phase6-performance-compare-doc"]
  },
  {
    id: "threshold-audit",
    title: "threshold registry 与 override 审计通过",
    derivation: "threshold-audit",
    evidenceArtifactIds: ["phase6-performance-compare-doc", "phase6-release-readiness-doc"]
  },
    {
      id: "manual-smoke",
      title: "manual smoke matrix 与手工证据归档",
      derivation: "manual-smoke",
      smokeScenarioIds: ["S6-04", "S6-05", "S6-06", "S6-07"],
      evidenceArtifactIds: ["phase6-regression-matrix-doc", "phase6-browser-smoke-report-doc"]
    },
  {
    id: "taste-signoff",
    title: "Taste sign-off 由人工签署",
    derivation: "artifact-presence",
    requiredArtifactIds: ["phase6-design-signoff-record"],
    evidenceArtifactIds: ["phase6-taste-signoff-doc", "phase6-design-signoff-record"]
  }
] as const;

export function buildPhase6PacingScenarioMap(): Record<DifficultyMode, string> {
  const result = {} as Partial<Record<DifficultyMode, string>>;

  for (const entry of PHASE6_SMOKE_SCENARIO_REGISTRY) {
    if (entry.evidenceType !== "automation" || entry.assessmentSource !== "pacing") {
      continue;
    }
    if (result[entry.difficulty] !== undefined) {
      throw new Error(`Duplicate pacing smoke scenario for difficulty: ${entry.difficulty}`);
    }
    result[entry.difficulty] = entry.scenarioName;
  }

  for (const difficulty of ["normal", "hard", "nightmare"] as const) {
    if (result[difficulty] === undefined) {
      throw new Error(`Missing pacing smoke scenario for difficulty: ${difficulty}`);
    }
  }

  return result as Record<DifficultyMode, string>;
}

export function derivePhase6SmokeMatrix(
  pacingAssessments: Record<DifficultyMode, PacingAssessment>
): Phase6SmokeMatrixEntry[] {
  return PHASE6_SMOKE_SCENARIO_REGISTRY.map((entry) => {
    if (entry.evidenceType === "automation") {
      const assessment = pacingAssessments[entry.difficulty];
      return {
        id: entry.id,
        title: entry.title,
        evidenceType: entry.evidenceType,
        status: assessment.alerts.length === 0 ? "pass" : "fail",
        evidence: [`${entry.difficulty}:${entry.scenarioName}`]
      };
    }
    const artifacts = entry.requiredArtifactIds
      .map((artifactId) => getPhase6ReleaseArtifact(artifactId))
      .filter((artifact): artifact is Phase6ReleaseArtifactEntry => artifact !== undefined);
    const hasPending = artifacts.some((artifact) => artifact.availability === "pending");
    const allPresent = artifacts.length === entry.requiredArtifactIds.length &&
      artifacts.every((artifact) => artifact.availability === "present");
    return {
      id: entry.id,
      title: entry.title,
      evidenceType: entry.evidenceType,
      status: hasPending ? "pending" : allPresent ? "pass" : "fail",
      evidence: artifacts.map((artifact) => artifact.path)
    };
  });
}

export function derivePhase6SignoffChecklist(
  pacingAssessments: Record<DifficultyMode, PacingAssessment>,
  thresholdAudit: ThresholdAuditResult,
  smokeMatrix: readonly Phase6SmokeMatrixEntry[]
): Phase6SignoffItem[] {
  const normal = pacingAssessments.normal;
  const hard = pacingAssessments.hard;
  const nightmare = pacingAssessments.nightmare;
  const cadenceEvidence = [
    `normal=${normal.skillCastsPer30s.toFixed(3)} active / ${normal.skillCastsPer30sRunClock.toFixed(3)} clock`,
    `hard=${hard.skillCastsPer30s.toFixed(3)} active / ${hard.skillCastsPer30sRunClock.toFixed(3)} clock`,
    `nightmare=${nightmare.skillCastsPer30s.toFixed(3)} active / ${nightmare.skillCastsPer30sRunClock.toFixed(3)} clock`
  ];

  return PHASE6_SIGNOFF_CHECKLIST_REGISTRY.map((entry) => {
    switch (entry.derivation) {
      case "timing-normal-p50":
        return {
          id: entry.id,
          title: entry.title,
          status: normal.runDurationP50WithinTarget ? "pass" : "fail",
          evidence: [`normal:p50=${normal.runDurationP50Ms}`, ...resolveArtifactPaths(entry.evidenceArtifactIds)]
        };
      case "timing-normal-p90":
        return {
          id: entry.id,
          title: entry.title,
          status: normal.runDurationP90WithinTarget ? "pass" : "fail",
          evidence: [`normal:p90=${normal.runDurationP90Ms}`, ...resolveArtifactPaths(entry.evidenceArtifactIds)]
        };
      case "timing-other-difficulties":
        return {
          id: entry.id,
          title: entry.title,
          status: hard !== undefined && nightmare !== undefined ? "pass" : "fail",
          evidence: ["hard,nightmare", ...resolveArtifactPaths(entry.evidenceArtifactIds)]
        };
      case "skill-cadence":
        return {
          id: entry.id,
          title: entry.title,
          status:
            normal.skillCadenceWithinTarget && hard.skillCadenceWithinTarget && nightmare.skillCadenceWithinTarget
              ? "pass"
              : "fail",
          evidence: [...cadenceEvidence, ...resolveArtifactPaths(entry.evidenceArtifactIds)]
        };
      case "threshold-audit":
        return {
          id: entry.id,
          title: entry.title,
          status: thresholdAudit.passed ? "pass" : "fail",
          evidence: [thresholdAudit.violations.join(",") || "ok", ...resolveArtifactPaths(entry.evidenceArtifactIds)]
        };
      case "manual-smoke": {
        const statuses = entry.smokeScenarioIds
          .map((scenarioId) => smokeMatrix.find((row) => row.id === scenarioId)?.status ?? "fail");
        const hasFail = statuses.includes("fail");
        const hasPending = statuses.includes("pending");
        return {
          id: entry.id,
          title: entry.title,
          status: hasFail ? "fail" : hasPending ? "pending" : "pass",
          evidence: [...entry.smokeScenarioIds, ...resolveArtifactPaths(entry.evidenceArtifactIds)]
        };
      }
      case "artifact-presence": {
        const artifacts = entry.requiredArtifactIds
          .map((artifactId) => getPhase6ReleaseArtifact(artifactId))
          .filter((artifact): artifact is Phase6ReleaseArtifactEntry => artifact !== undefined);
        const hasPending = artifacts.some((artifact) => artifact.availability === "pending");
        const allPresent = artifacts.length === entry.requiredArtifactIds.length &&
          artifacts.every((artifact) => artifact.availability === "present");
        return {
          id: entry.id,
          title: entry.title,
          status: hasPending ? "pending" : allPresent ? "pass" : "fail",
          evidence: [
            ...artifacts.map((artifact) => artifact.path),
            ...resolveArtifactPaths(entry.evidenceArtifactIds)
          ]
        };
      }
    }
  });
}
