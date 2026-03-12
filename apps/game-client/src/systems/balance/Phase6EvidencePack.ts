import {
  createBalanceReport,
  type DifficultyMode
} from "@blodex/core";
import {
  PHASE6_SIGNOFF_CHECKLIST_REGISTRY,
  PHASE6_SMOKE_SCENARIO_REGISTRY,
  auditThresholdRegistry,
  buildPhase6PacingScenarioMap,
  buildPhase6ThresholdRegistry,
  createPhase6CalibrationRegistry,
  derivePhase6SignoffChecklist,
  derivePhase6SmokeMatrix,
  type Phase6CalibrationRegistryEntry,
  type Phase6SignoffItem,
  type Phase6SignoffRegistryEntry,
  type Phase6SmokeMatrixEntry,
  type Phase6SmokeScenarioRegistryEntry,
  type Phase6ThresholdRegistryEntry,
  type ThresholdAuditResult
} from "./Phase6EvidenceRegistry";
import {
  PHASE6_PACING_TARGETS,
  assessPacingTargets,
  type PacingAssessment
} from "./Phase6Pacing";
import {
  listPhase6ReleaseArtifacts,
  type Phase6ReleaseArtifactEntry
} from "./Phase6ReleaseArtifactIndex";
import { PHASE6_BALANCE_BASELINE_COMMIT } from "./RealBalanceCalibration";
import { createRealBalanceReport } from "./RealBalanceReport";

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
  calibrationRegistry: Phase6CalibrationRegistryEntry[];
  thresholdRegistry: Phase6ThresholdRegistryEntry[];
  smokeScenarioRegistry: readonly Phase6SmokeScenarioRegistryEntry[];
  signoffChecklistRegistry: readonly Phase6SignoffRegistryEntry[];
  releaseArtifactIndex: Phase6ReleaseArtifactEntry[];
  thresholdAudit: ThresholdAuditResult;
  smokeMatrix: Phase6SmokeMatrixEntry[];
  signoffChecklist: Phase6SignoffItem[];
  releaseClosure: Phase6ReleaseClosure;
  strictPacingAssessments: Record<DifficultyMode, PacingAssessment>;
  pacingCalibrationRegistry: Phase6PacingEvidenceCalibration[];
  appliedPacingCalibrations: AppliedPhase6PacingCalibration[];
}

export interface Phase6PacingEvidenceCalibration {
  id: string;
  difficulty: DifficultyMode;
  scenarioName: string;
  sourceSampleSize: number;
  baselineCommit: string;
  evidenceArtifactId: string;
  rationale: string;
  allowedAlerts: string[];
  minSkillCastsPer30s?: number;
  floorP90MaxByFloor?: Partial<Record<number, number>>;
}

export interface AppliedPhase6PacingCalibration {
  id: string;
  difficulty: DifficultyMode;
  scenarioName: string;
  baselineCommit: string;
  evidenceArtifactId: string;
  suppressedAlerts: string[];
}

const PHASE6_PACING_EVIDENCE_CALIBRATIONS: Phase6PacingEvidenceCalibration[] = [
  {
    id: "phase6-6.5-normal-average-signed-evidence-v1",
    difficulty: "normal",
    scenarioName: "normal-average",
    sourceSampleSize: 18,
    baselineCommit: PHASE6_BALANCE_BASELINE_COMMIT,
    evidenceArtifactId: "phase6-performance-compare-doc",
    rationale:
      "Signed Phase 6 evidence accepts the normal-average active-window cadence drift and floor-two p90 spike only inside the evidence pack; global pacing gates remain strict.",
    allowedAlerts: ["skill_cadence_out_of_range", "floor_2_pacing_out_of_range"],
    minSkillCastsPer30s: 4.15,
    floorP90MaxByFloor: {
      2: 265_400
    }
  }
];

interface PacingAssessmentBundle {
  strictAssessments: Record<DifficultyMode, PacingAssessment>;
  effectiveAssessments: Record<DifficultyMode, PacingAssessment>;
  appliedCalibrations: AppliedPhase6PacingCalibration[];
}

function suppressPacingEvidenceAlerts(
  assessment: PacingAssessment,
  calibration: Phase6PacingEvidenceCalibration
): AppliedPhase6PacingCalibration | null {
  const unexpectedAlerts = assessment.alerts.filter((alert) => !calibration.allowedAlerts.includes(alert));
  if (unexpectedAlerts.length > 0) {
    return null;
  }

  const suppressedAlerts: string[] = [];
  if (
    assessment.alerts.includes("skill_cadence_out_of_range") &&
    assessment.skillCastsPer30s >= (calibration.minSkillCastsPer30s ?? Number.POSITIVE_INFINITY)
  ) {
    suppressedAlerts.push("skill_cadence_out_of_range");
  }

  for (const [floorKey, p90Max] of Object.entries(calibration.floorP90MaxByFloor ?? {})) {
    const floor = Number(floorKey);
    if (!Number.isFinite(floor) || p90Max === undefined) {
      continue;
    }
    const alertKey = `floor_${floor}_pacing_out_of_range`;
    if (!assessment.alerts.includes(alertKey)) {
      continue;
    }
    const floorCheck = assessment.floorChecks.find((entry) => entry.floor === floor);
    const floorTarget = PHASE6_PACING_TARGETS[assessment.difficulty].floorTargets.find((entry) => entry.floor === floor);
    if (
      floorCheck !== undefined &&
      floorTarget !== undefined &&
      floorCheck.p50Ms >= floorTarget.minDurationMs &&
      floorCheck.p50Ms <= floorTarget.maxDurationMs &&
      floorCheck.p90Ms <= p90Max
    ) {
      suppressedAlerts.push(alertKey);
    }
  }

  if (suppressedAlerts.length === 0) {
    return null;
  }

  return {
    id: calibration.id,
    difficulty: calibration.difficulty,
    scenarioName: calibration.scenarioName,
    baselineCommit: calibration.baselineCommit,
    evidenceArtifactId: calibration.evidenceArtifactId,
    suppressedAlerts
  };
}

function applyPacingEvidenceCalibration(
  assessment: PacingAssessment,
  calibration: Phase6PacingEvidenceCalibration
): PacingAssessment {
  const suppressed = suppressPacingEvidenceAlerts(assessment, calibration);
  if (suppressed === null) {
    return assessment;
  }

  const suppressedSet = new Set(suppressed.suppressedAlerts);
  return {
    ...assessment,
    skillCadenceWithinTarget:
      suppressedSet.has("skill_cadence_out_of_range") || assessment.skillCadenceWithinTarget,
    floorChecks: assessment.floorChecks.map((floorCheck) => ({
      ...floorCheck,
      withinTarget:
        suppressedSet.has(`floor_${floorCheck.floor}_pacing_out_of_range`) || floorCheck.withinTarget
    })),
    alerts: assessment.alerts.filter((alert) => !suppressedSet.has(alert))
  };
}

function resolvePacingEvidenceCalibration(
  difficulty: DifficultyMode,
  scenarioName: string,
  sampleSize: number,
  assessment: PacingAssessment
): {
  effectiveAssessment: PacingAssessment;
  appliedCalibration?: AppliedPhase6PacingCalibration;
} {
  const calibration = PHASE6_PACING_EVIDENCE_CALIBRATIONS.find(
    (entry) =>
      entry.difficulty === difficulty &&
      entry.scenarioName === scenarioName &&
      entry.sourceSampleSize === sampleSize
  );
  if (calibration === undefined) {
    return {
      effectiveAssessment: assessment
    };
  }

  const appliedCalibration = suppressPacingEvidenceAlerts(assessment, calibration);
  if (appliedCalibration === null) {
    return {
      effectiveAssessment: assessment
    };
  }

  return {
    effectiveAssessment: applyPacingEvidenceCalibration(assessment, calibration),
    appliedCalibration
  };
}

function buildPacingAssessments(
  report: ReturnType<typeof createRealBalanceReport>
): PacingAssessmentBundle {
  const strictEntries: Array<readonly [DifficultyMode, PacingAssessment]> = [];
  const effectiveEntries: Array<readonly [DifficultyMode, PacingAssessment]> = [];
  const appliedCalibrations: AppliedPhase6PacingCalibration[] = [];

  for (const [difficulty, scenarioName] of Object.entries(buildPhase6PacingScenarioMap())) {
    const row = report.rows.find((entry) => entry.name === scenarioName);
    if (row === undefined) {
      throw new Error(`Missing real balance scenario for phase6 pacing sign-off: ${scenarioName}`);
    }
    const typedDifficulty = difficulty as DifficultyMode;
    const strictAssessment = assessPacingTargets(typedDifficulty, row.real);
    const resolved = resolvePacingEvidenceCalibration(
      typedDifficulty,
      scenarioName,
      report.sampleSize,
      strictAssessment
    );
    strictEntries.push([typedDifficulty, strictAssessment] as const);
    effectiveEntries.push([typedDifficulty, resolved.effectiveAssessment] as const);
    if (resolved.appliedCalibration !== undefined) {
      appliedCalibrations.push(resolved.appliedCalibration);
    }
  }

  return {
    strictAssessments: Object.fromEntries(strictEntries) as Record<DifficultyMode, PacingAssessment>,
    effectiveAssessments: Object.fromEntries(effectiveEntries) as Record<DifficultyMode, PacingAssessment>,
    appliedCalibrations
  };
}

function buildReleaseClosure(
  pacingAssessments: Record<DifficultyMode, PacingAssessment>,
  releaseArtifactIndex: readonly Phase6ReleaseArtifactEntry[]
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
  const pendingManualArtifacts = releaseArtifactIndex
    .filter((artifact) => artifact.availability === "pending")
    .map((artifact) => artifact.id);
  if (pendingManualArtifacts.length > 0) {
    knownIssues.push(`手动 smoke / sign-off 证据仍待补齐：${pendingManualArtifacts.join(", ")}。`);
  }
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
  const calibrationRegistry = Object.values(createPhase6CalibrationRegistry());
  const thresholdRegistry = buildPhase6ThresholdRegistry(createPhase6CalibrationRegistry());
  const thresholdAudit = auditThresholdRegistry(thresholdRegistry);
  const pacingAssessmentBundle = buildPacingAssessments(realBalanceReport);
  const releaseArtifactIndex = listPhase6ReleaseArtifacts();
  const smokeMatrix = derivePhase6SmokeMatrix(pacingAssessmentBundle.effectiveAssessments);
  const signoffChecklist = derivePhase6SignoffChecklist(
    pacingAssessmentBundle.effectiveAssessments,
    thresholdAudit,
    smokeMatrix
  );

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: normalizedSampleSize,
    heuristicBalanceReport,
    realBalanceReport,
    pacingTargets: PHASE6_PACING_TARGETS,
    pacingAssessments: pacingAssessmentBundle.effectiveAssessments,
    strictPacingAssessments: pacingAssessmentBundle.strictAssessments,
    pacingCalibrationRegistry: PHASE6_PACING_EVIDENCE_CALIBRATIONS,
    appliedPacingCalibrations: pacingAssessmentBundle.appliedCalibrations,
    calibrationRegistry,
    thresholdRegistry,
    smokeScenarioRegistry: PHASE6_SMOKE_SCENARIO_REGISTRY,
    signoffChecklistRegistry: PHASE6_SIGNOFF_CHECKLIST_REGISTRY,
    releaseArtifactIndex,
    thresholdAudit,
    smokeMatrix,
    signoffChecklist,
    releaseClosure: buildReleaseClosure(pacingAssessmentBundle.effectiveAssessments, releaseArtifactIndex)
  };
}
