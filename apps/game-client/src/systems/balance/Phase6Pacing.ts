import type { DifficultyMode, RunSimulation } from "@blodex/core";
import { defaultBaseStats, deriveStats } from "@blodex/core";
import { GAME_CONFIG, getFloorConfig } from "@blodex/content";

export interface FloorPacingTarget {
  floor: number;
  minDurationMs: number;
  targetDurationMs: number;
  maxDurationMs: number;
  monsterCount: number;
  revealThresholdKills: number;
  mapWidth: number;
  mapHeight: number;
}

export interface DifficultyPacingTarget {
  difficulty: DifficultyMode;
  runDurationP50RangeMs: {
    min: number;
    max: number;
  };
  runDurationP90MaxMs: number;
  coreSkillCastsPer30sRange: {
    min: number;
    max: number;
  };
  playerMoveSpeedBaseline: number;
  expectedEventNodesPerRun: number;
  expectedMerchantNodesPerRun: number;
  floorTargets: FloorPacingTarget[];
}

export interface PacingAssessment {
  difficulty: DifficultyMode;
  runDurationP50Ms: number;
  runDurationP90Ms: number;
  skillCastsPer30s: number;
  skillCastsPer30sRunClock: number;
  runDurationP50WithinTarget: boolean;
  runDurationP90WithinTarget: boolean;
  skillCadenceWithinTarget: boolean;
  floorChecks: Array<{
    floor: number;
    p50Ms: number;
    p90Ms: number;
    withinTarget: boolean;
  }>;
  alerts: string[];
}

function createFloorTargets(targetDurationsMs: readonly number[]): FloorPacingTarget[] {
  return targetDurationsMs.map((targetDurationMs, index) => {
    const floor = index + 1;
    const floorConfig = getFloorConfig(floor);
    const slackMs = floor >= 4 ? 75_000 : floor === 3 ? 60_000 : 45_000;
    return {
      floor,
      minDurationMs: targetDurationMs - slackMs,
      targetDurationMs,
      maxDurationMs: targetDurationMs + slackMs,
      monsterCount: floorConfig.monsterCount,
      revealThresholdKills: Math.ceil(floorConfig.monsterCount * floorConfig.clearThreshold),
      mapWidth: GAME_CONFIG.gridWidth,
      mapHeight: GAME_CONFIG.gridHeight
    };
  });
}

const PLAYER_MOVE_SPEED_BASELINE = deriveStats(defaultBaseStats(), []).moveSpeed;

export const PHASE6_PACING_TARGETS: Record<DifficultyMode, DifficultyPacingTarget> = {
  normal: {
    difficulty: "normal",
    runDurationP50RangeMs: {
      min: 12 * 60_000,
      max: 18 * 60_000
    },
    runDurationP90MaxMs: 20 * 60_000,
    coreSkillCastsPer30sRange: {
      min: 4.5,
      max: 8.5
    },
    playerMoveSpeedBaseline: PLAYER_MOVE_SPEED_BASELINE,
    expectedEventNodesPerRun: 2,
    expectedMerchantNodesPerRun: 1,
    floorTargets: createFloorTargets([120_000, 150_000, 180_000, 210_000, 240_000])
  },
  hard: {
    difficulty: "hard",
    runDurationP50RangeMs: {
      min: 14 * 60_000,
      max: 20 * 60_000
    },
    runDurationP90MaxMs: 22 * 60_000,
    coreSkillCastsPer30sRange: {
      min: 4,
      max: 8
    },
    playerMoveSpeedBaseline: PLAYER_MOVE_SPEED_BASELINE,
    expectedEventNodesPerRun: 2,
    expectedMerchantNodesPerRun: 1,
    floorTargets: createFloorTargets([135_000, 165_000, 195_000, 225_000, 255_000])
  },
  nightmare: {
    difficulty: "nightmare",
    runDurationP50RangeMs: {
      min: 15 * 60_000,
      max: 22 * 60_000
    },
    runDurationP90MaxMs: 24 * 60_000,
    coreSkillCastsPer30sRange: {
      min: 4,
      max: 9
    },
    playerMoveSpeedBaseline: PLAYER_MOVE_SPEED_BASELINE,
    expectedEventNodesPerRun: 2,
    expectedMerchantNodesPerRun: 1,
    floorTargets: createFloorTargets([150_000, 180_000, 210_000, 240_000, 270_000])
  }
};

export function assessPacingTargets(difficulty: DifficultyMode, report: RunSimulation): PacingAssessment {
  const target = PHASE6_PACING_TARGETS[difficulty];
  const pacing = report.pacing;
  const runDurationP50Ms = pacing?.runDurationP50Ms ?? 0;
  const runDurationP90Ms = pacing?.runDurationP90Ms ?? 0;
  const runDurationP50WithinTarget =
    runDurationP50Ms >= target.runDurationP50RangeMs.min &&
    runDurationP50Ms <= target.runDurationP50RangeMs.max;
  const runDurationP90WithinTarget = runDurationP90Ms <= target.runDurationP90MaxMs;
  const skillCastsPer30s = report.combatRhythm?.avgSkillCastsPer30s ?? 0;
  const skillCastsPer30sRunClock = report.combatRhythm?.avgSkillCastsPer30sRunClock ?? 0;
  const skillCadenceWithinTarget =
    skillCastsPer30s >= target.coreSkillCastsPer30sRange.min &&
    skillCastsPer30s <= target.coreSkillCastsPer30sRange.max;

  const alerts: string[] = [];
  if (pacing === undefined) {
    alerts.push("pacing_metrics_missing");
  }
  if (!runDurationP50WithinTarget) {
    alerts.push("run_duration_p50_out_of_range");
  }
  if (!runDurationP90WithinTarget) {
    alerts.push("run_duration_p90_out_of_range");
  }
  if (!skillCadenceWithinTarget) {
    alerts.push("skill_cadence_out_of_range");
  }

  const floorChecks = target.floorTargets.map((floorTarget, index) => {
    const p50Ms = pacing?.floorDurationP50Ms[index] ?? 0;
    const p90Ms = pacing?.floorDurationP90Ms[index] ?? 0;
    const withinTarget =
      p50Ms >= floorTarget.minDurationMs &&
      p50Ms <= floorTarget.maxDurationMs &&
      (p90Ms === 0 || p90Ms <= floorTarget.maxDurationMs + 45_000);
    if (!withinTarget) {
      alerts.push(`floor_${floorTarget.floor}_pacing_out_of_range`);
    }
    return {
      floor: floorTarget.floor,
      p50Ms,
      p90Ms,
      withinTarget
    };
  });

  return {
    difficulty,
    runDurationP50Ms,
    runDurationP90Ms,
    skillCastsPer30s,
    skillCastsPer30sRunClock,
    runDurationP50WithinTarget,
    runDurationP90WithinTarget,
    skillCadenceWithinTarget,
    floorChecks,
    alerts
  };
}
