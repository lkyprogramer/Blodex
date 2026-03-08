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
}

function buildPacingAssessments(
  report: ReturnType<typeof createRealBalanceReport>
): Record<DifficultyMode, PacingAssessment> {
  const entries = Object.entries(buildPhase6PacingScenarioMap()).map(([difficulty, scenarioName]) => {
    const row = report.rows.find((entry) => entry.name === scenarioName);
    if (row === undefined) {
      throw new Error(`Missing real balance scenario for phase6 pacing sign-off: ${scenarioName}`);
    }
    return [difficulty, assessPacingTargets(difficulty as DifficultyMode, row.real)] as const;
  });
  return Object.fromEntries(entries) as Record<DifficultyMode, PacingAssessment>;
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
  const pacingAssessments = buildPacingAssessments(realBalanceReport);
  const releaseArtifactIndex = listPhase6ReleaseArtifacts();
  const smokeMatrix = derivePhase6SmokeMatrix(pacingAssessments);
  const signoffChecklist = derivePhase6SignoffChecklist(
    pacingAssessments,
    thresholdAudit,
    smokeMatrix
  );

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: normalizedSampleSize,
    heuristicBalanceReport,
    realBalanceReport,
    pacingTargets: PHASE6_PACING_TARGETS,
    pacingAssessments,
    calibrationRegistry,
    thresholdRegistry,
    smokeScenarioRegistry: PHASE6_SMOKE_SCENARIO_REGISTRY,
    signoffChecklistRegistry: PHASE6_SIGNOFF_CHECKLIST_REGISTRY,
    releaseArtifactIndex,
    thresholdAudit,
    smokeMatrix,
    signoffChecklist,
    releaseClosure: buildReleaseClosure(pacingAssessments, releaseArtifactIndex)
  };
}
