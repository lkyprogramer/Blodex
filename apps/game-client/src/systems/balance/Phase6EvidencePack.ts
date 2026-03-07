import {
  createBalanceReport,
  type DifficultyMode
} from "@blodex/core";
import {
  createRealBalanceReport,
  DEFAULT_BALANCE_DRIFT_THRESHOLDS,
  type BalanceDriftThresholds
} from "./RealBalanceReport";
import {
  DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS,
  PHASE6_BALANCE_BASELINE_COMMIT,
  type BalanceDriftCalibrationRecord
} from "./RealBalanceCalibration";
import { PHASE6_PACING_TARGETS, assessPacingTargets, type PacingAssessment } from "./Phase6Pacing";

export interface ThresholdRegistryEntry {
  scope: "global_default" | "scenario_override";
  id: string;
  metricThresholds: Partial<BalanceDriftThresholds>;
  scenarioName?: string;
  sourceSampleSize?: number;
  baselineCommit: string;
  evidenceRef: string;
  rationale: string;
}

export interface ThresholdAuditResult {
  passed: boolean;
  violations: string[];
}

export interface Phase6SmokeMatrixEntry {
  id: string;
  title: string;
  evidenceType: "automation" | "manual";
  status: "pass" | "pending" | "fail";
}

export interface Phase6SignoffItem {
  id: string;
  title: string;
  status: "pass" | "pending" | "fail";
  evidence: string;
}

export interface Phase6ReleaseClosure {
  featureFlags: Array<{
    id: string;
    strategy: "rollback_branch" | "runtime_option";
    owner: string;
    fallback: string;
  }>;
  knownIssues: string[];
}

export interface Phase6EvidencePack {
  generatedAt: string;
  sampleSize: number;
  heuristicBalanceReport: ReturnType<typeof createBalanceReport>;
  realBalanceReport: ReturnType<typeof createRealBalanceReport>;
  pacingTargets: typeof PHASE6_PACING_TARGETS;
  pacingAssessments: Record<DifficultyMode, PacingAssessment>;
  thresholdRegistry: ThresholdRegistryEntry[];
  thresholdAudit: ThresholdAuditResult;
  smokeMatrix: Phase6SmokeMatrixEntry[];
  signoffChecklist: Phase6SignoffItem[];
  releaseClosure: Phase6ReleaseClosure;
}

const PHASE6_RELEASE_SIGNOFF_SCENARIOS: Record<DifficultyMode, string> = {
  normal: "normal-average",
  hard: "hard-average",
  nightmare: "nightmare-optimal"
};

function buildThresholdRegistry(
  calibrations: Record<string, BalanceDriftCalibrationRecord>
): ThresholdRegistryEntry[] {
  return [
    {
      scope: "global_default",
      id: "phase6-default-drift-thresholds",
      metricThresholds: DEFAULT_BALANCE_DRIFT_THRESHOLDS,
      baselineCommit: PHASE6_BALANCE_BASELINE_COMMIT,
      evidenceRef: "apps/game-client/src/systems/balance/RealBalanceReport.ts",
      rationale:
        "Phase 6 default drift thresholds are globally frozen and must not be widened without scenario-scoped evidence."
    },
    ...Object.values(calibrations).map((record) => ({
      scope: "scenario_override" as const,
      id: record.id,
      metricThresholds: record.thresholds,
      scenarioName: record.scenarioName,
      sourceSampleSize: record.sourceSampleSize,
      baselineCommit: record.baselineCommit,
      evidenceRef: "apps/game-client/src/systems/balance/RealBalanceCalibration.ts",
      rationale: record.rationale
    }))
  ];
}

export function auditThresholdRegistry(entries: readonly ThresholdRegistryEntry[]): ThresholdAuditResult {
  const violations: string[] = [];
  const defaultEntries = entries.filter((entry) => entry.scope === "global_default");
  if (defaultEntries.length !== 1) {
    violations.push("global_default_registry_count_invalid");
  }
  for (const entry of entries) {
    if (!entry.baselineCommit || !entry.evidenceRef || !entry.rationale) {
      violations.push(`registry_metadata_incomplete:${entry.id}`);
    }
    if (entry.scope === "scenario_override") {
      if (!entry.scenarioName) {
        violations.push(`registry_override_missing_scenario:${entry.id}`);
      }
      if ((entry.sourceSampleSize ?? 0) <= 0) {
        violations.push(`registry_override_missing_sample_size:${entry.id}`);
      }
    }
  }
  return {
    passed: violations.length === 0,
    violations
  };
}

function buildPacingAssessments(
  report: ReturnType<typeof createRealBalanceReport>
): Record<DifficultyMode, PacingAssessment> {
  const entries = Object.entries(PHASE6_RELEASE_SIGNOFF_SCENARIOS).map(([difficulty, scenarioName]) => {
    const row = report.rows.find((entry) => entry.name === scenarioName);
    if (row === undefined) {
      throw new Error(`Missing real balance scenario for phase6 pacing sign-off: ${scenarioName}`);
    }
    return [difficulty, assessPacingTargets(difficulty as DifficultyMode, row.real)] as const;
  });
  return Object.fromEntries(entries) as Record<DifficultyMode, PacingAssessment>;
}

function buildSmokeMatrix(
  pacingAssessments: Record<DifficultyMode, PacingAssessment>
): Phase6SmokeMatrixEntry[] {
  return [
    {
      id: "S6-01",
      title: "Normal story run",
      evidenceType: "automation",
      status: pacingAssessments.normal.alerts.length === 0 ? "pass" : "fail"
    },
    {
      id: "S6-02",
      title: "Hard story run",
      evidenceType: "automation",
      status: pacingAssessments.hard.alerts.length === 0 ? "pass" : "fail"
    },
    {
      id: "S6-03",
      title: "Nightmare story run",
      evidenceType: "automation",
      status: pacingAssessments.nightmare.alerts.length === 0 ? "pass" : "fail"
    },
    { id: "S6-04", title: "rare / build / boss 峰值 run", evidenceType: "manual", status: "pending" },
    { id: "S6-05", title: "三职业起步深度 run", evidenceType: "manual", status: "pending" },
    { id: "S6-06", title: "trade-off item run", evidenceType: "manual", status: "pending" },
    { id: "S6-07", title: "buff / damageType / synergy 合同 run", evidenceType: "manual", status: "pending" }
  ];
}

function buildSignoffChecklist(
  pacingAssessments: Record<DifficultyMode, PacingAssessment>,
  thresholdAudit: ThresholdAuditResult
): Phase6SignoffItem[] {
  const normal = pacingAssessments.normal;
  const hard = pacingAssessments.hard;
  const nightmare = pacingAssessments.nightmare;
  const cadenceEvidence = [
    `normal=${normal.skillCastsPer30s.toFixed(3)} active / ${normal.skillCastsPer30sRunClock.toFixed(3)} clock`,
    `hard=${hard.skillCastsPer30s.toFixed(3)} active / ${hard.skillCastsPer30sRunClock.toFixed(3)} clock`,
    `nightmare=${nightmare.skillCastsPer30s.toFixed(3)} active / ${nightmare.skillCastsPer30sRunClock.toFixed(3)} clock`
  ].join("; ");
  return [
    {
      id: "timing-normal-p50",
      title: "Normal 中位数 run 时长稳定在 12~18 min",
      status: normal.runDurationP50WithinTarget ? "pass" : "fail",
      evidence: `normal:p50=${normal.runDurationP50Ms}`
    },
    {
      id: "timing-normal-p90",
      title: "Normal P90 <= 20 min",
      status: normal.runDurationP90WithinTarget ? "pass" : "fail",
      evidence: `normal:p90=${normal.runDurationP90Ms}`
    },
    {
      id: "timing-other-difficulties",
      title: "Hard / Nightmare pacing assessment 已生成",
      status: hard !== undefined && nightmare !== undefined ? "pass" : "fail",
      evidence: "hard,nightmare"
    },
    {
      id: "skill-cadence",
      title: "core skill cadence（active combat window）达标",
      status:
        normal.skillCadenceWithinTarget && hard.skillCadenceWithinTarget && nightmare.skillCadenceWithinTarget
          ? "pass"
          : "fail",
      evidence: cadenceEvidence
    },
    {
      id: "threshold-audit",
      title: "threshold registry 与 override 审计通过",
      status: thresholdAudit.passed ? "pass" : "fail",
      evidence: thresholdAudit.violations.join(",") || "ok"
    },
    {
      id: "manual-smoke",
      title: "manual smoke matrix 与录像证据归档",
      status: "pending",
      evidence: "docs/plans/phase6/release/2026-03-06-phase6-regression-matrix.md"
    },
    {
      id: "taste-signoff",
      title: "Taste sign-off 由人工签署",
      status: "pending",
      evidence: "docs/plans/phase6/release/2026-03-06-phase6-taste-signoff.md"
    }
  ];
}

function buildReleaseClosure(
  pacingAssessments: Record<DifficultyMode, PacingAssessment>
): Phase6ReleaseClosure {
  const knownIssues: string[] = [];
  const cadenceOutliers = Object.values(pacingAssessments)
    .filter((assessment) => !assessment.skillCadenceWithinTarget)
    .map((assessment) => {
      const target = PHASE6_PACING_TARGETS[assessment.difficulty].coreSkillCastsPer30sRange;
      return `${assessment.difficulty}=${assessment.skillCastsPer30s.toFixed(3)} active (target ${target.min}~${target.max})`;
    });
  if (cadenceOutliers.length > 0) {
    knownIssues.push(`active combat cadence 仍有越界场景：${cadenceOutliers.join(", ")}。`);
  }
  const nightmare = pacingAssessments.nightmare;
  if (!nightmare.runDurationP50WithinTarget) {
    knownIssues.push(
      `nightmare P50 仍低于目标下限：${nightmare.runDurationP50Ms}ms < ${PHASE6_PACING_TARGETS.nightmare.runDurationP50RangeMs.min}ms。`
    );
  }
  knownIssues.push("手动录像与人工复盘证据仍需在发布前补齐。");
  knownIssues.push("threshold registry 当前引用仓内证据路径，release 文档需再补归档链接。");
  return {
    featureFlags: [
      {
        id: "phase6-release-rollback",
        strategy: "rollback_branch",
        owner: "release-engineering",
        fallback: "Revert PRs #50~#54 in reverse order and rerun pnpm ci:check."
      }
    ],
    knownIssues
  };
}

export function createPhase6EvidencePack(sampleSize = 18): Phase6EvidencePack {
  const normalizedSampleSize = Math.max(1, Math.floor(sampleSize));
  const heuristicBalanceReport = createBalanceReport(normalizedSampleSize);
  const realBalanceReport = createRealBalanceReport(normalizedSampleSize);
  const thresholdRegistry = buildThresholdRegistry(DEFAULT_REAL_BALANCE_SCENARIO_CALIBRATIONS);
  const thresholdAudit = auditThresholdRegistry(thresholdRegistry);
  const pacingAssessments = buildPacingAssessments(realBalanceReport);
  return {
    generatedAt: new Date().toISOString(),
    sampleSize: normalizedSampleSize,
    heuristicBalanceReport,
    realBalanceReport,
    pacingTargets: PHASE6_PACING_TARGETS,
    pacingAssessments,
    thresholdRegistry,
    thresholdAudit,
    smokeMatrix: buildSmokeMatrix(pacingAssessments),
    signoffChecklist: buildSignoffChecklist(pacingAssessments, thresholdAudit),
    releaseClosure: buildReleaseClosure(pacingAssessments)
  };
}
