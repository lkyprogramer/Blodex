import type { DifficultyMode } from "./contracts/types";
import { getDifficultyModifier } from "./difficulty";
import { estimateStoryFloorPacingOverheadMs } from "./pacingModel";
import { SeededRng } from "./rng";

const DEFAULT_FLOORS = 5;

const BEHAVIOR_POWER: Record<BalanceConfig["playerBehavior"], number> = {
  optimal: 1.26,
  average: 1,
  poor: 0.82
};

const BEHAVIOR_RECOVERY: Record<BalanceConfig["playerBehavior"], number> = {
  optimal: 1.35,
  average: 1,
  poor: 0.75
};

export interface BalanceConfig {
  difficulty: DifficultyMode;
  playerBehavior: "optimal" | "average" | "poor";
  sampleSize: number;
  seedBase: string;
  maxFloors?: number;
}

export interface RunSimulation {
  clearRate: number;
  avgFloorReached: number;
  avgRunDurationMs: number;
  hpCurveP50: number[];
  hpCurveP90: number[];
  deathCauseDistribution: Record<string, number>;
  itemRarityDistribution: Record<string, number>;
  pacing?: {
    runDurationP50Ms: number;
    runDurationP90Ms: number;
    floorDurationP50Ms: number[];
    floorDurationP90Ms: number[];
  };
  combatRhythm?: {
    avgSkillUsesPerRun: number;
    avgSkillCastsPer30s: number;
    avgSkillCastsPer30sRunClock?: number;
    avgSkillDamageShare: number;
    avgAutoAttackDamageShare: number;
  };
  powerSpikes?: {
    avgAcceptedSpikesPerRun: number;
    avgMajorSpikesPerRun: number;
    pairSatisfactionRate: Record<string, number>;
  };
}

interface SimulatedRun {
  cleared: boolean;
  floorReached: number;
  runDurationMs: number;
  floorDurationsMs: number[];
  hpByFloor: number[];
  deathCause: string;
  rarityCounts: Record<"common" | "magic" | "rare", number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(clamp(ratio, 0, 1) * (sorted.length - 1));
  return Number(sorted[index]?.toFixed(4) ?? 0);
}

function rollRarity(floor: number, rng: SeededRng): "common" | "magic" | "rare" {
  const roll = rng.next();
  const rareThreshold = clamp(0.03 + floor * 0.02, 0.03, 0.2);
  const magicThreshold = clamp(0.28 + floor * 0.03, 0.25, 0.62);
  if (roll <= rareThreshold) {
    return "rare";
  }
  if (roll <= magicThreshold) {
    return "magic";
  }
  return "common";
}

function resolveDeathCause(floorReached: number, hp: number, rng: SeededRng): string {
  if (hp <= 0.01) {
    return floorReached >= DEFAULT_FLOORS ? "boss_burst" : "chip_damage";
  }
  if (floorReached >= DEFAULT_FLOORS) {
    return "boss_pressure";
  }
  return rng.next() > 0.5 ? "elite_swarm" : "attrition";
}

function simulateSingleRun(config: BalanceConfig, index: number): SimulatedRun {
  const floors = Math.max(1, Math.floor(config.maxFloors ?? DEFAULT_FLOORS));
  const rng = new SeededRng(
    `${config.seedBase}:${config.difficulty}:${config.playerBehavior}:run:${index}`
  );
  const modifier = getDifficultyModifier(config.difficulty);
  let hp = 1;
  let cleared = true;
  let floorReached = 0;
  let runDurationMs = 0;
  const floorDurationsMs = new Array<number>(floors).fill(0);
  const hpByFloor = new Array<number>(floors).fill(0);
  const rarityCounts: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  const behaviorPower = BEHAVIOR_POWER[config.playerBehavior];
  const behaviorRecovery = BEHAVIOR_RECOVERY[config.playerBehavior];

  for (let floor = 1; floor <= floors; floor += 1) {
    const floorThreat = 0.72 + floor * 0.14;
    const pressure =
      floorThreat *
      (modifier.monsterDamageMultiplier * 0.56 + modifier.monsterHealthMultiplier * 0.44);
    const effectivePressure = Math.pow(pressure, 0.72);
    const playerControl = behaviorPower + (rng.next() - 0.5) * 0.16;
    const clearScore = playerControl / Math.max(0.25, effectivePressure);
    const clearThreshold = floor === floors ? 0.78 : 0.7;
    const behaviorClearBonus =
      config.playerBehavior === "optimal" ? 0.1 : config.playerBehavior === "poor" ? -0.04 : 0;
    const clearChance = clamp(clearScore - clearThreshold + 0.7 + behaviorClearBonus, 0.08, 0.97);
    const floorCleared = rng.next() <= clearChance;

    const hpLoss = clamp(
      (effectivePressure / Math.max(0.55, playerControl)) * 0.14 + rng.next() * 0.04,
      0.03,
      0.45
    );
    const hpRecoverBase = floorCleared ? (0.08 + floor * 0.01) * behaviorRecovery : 0;
    const hpRecover = clamp(hpRecoverBase, 0, 0.2);
    hp = clamp(hp - hpLoss + hpRecover, 0, 1);

    const floorDurationMs = Math.floor(
      34_000 +
        floor * 4_200 +
        pressure * 6_500 +
        (1.2 - behaviorPower) * 5_400 +
        rng.nextInt(0, 2_400)
    );
    const pacedFloorDurationMs =
      floorDurationMs +
      estimateStoryFloorPacingOverheadMs({
        floor,
        difficulty: config.difficulty,
        playerBehavior: config.playerBehavior,
        isBossFloor: floor === floors
      });
    runDurationMs += pacedFloorDurationMs;
    floorDurationsMs[floor - 1] = pacedFloorDurationMs;
    floorReached = floor;
    hpByFloor[floor - 1] = Number(hp.toFixed(4));

    const dropRolls = 2 + floor + (config.playerBehavior === "optimal" ? 1 : 0);
    for (let i = 0; i < dropRolls; i += 1) {
      const rarity = rollRarity(floor, rng);
      rarityCounts[rarity] += 1;
    }

    if (!floorCleared || hp <= 0) {
      cleared = false;
      break;
    }
  }

  for (let i = floorReached; i < floors; i += 1) {
    hpByFloor[i] = 0;
  }

  return {
    cleared: cleared && floorReached >= floors && hp > 0,
    floorReached,
    runDurationMs,
    floorDurationsMs,
    hpByFloor,
    deathCause: cleared && floorReached >= floors && hp > 0 ? "none" : resolveDeathCause(floorReached, hp, rng),
    rarityCounts
  };
}

export function simulateRun(config: BalanceConfig): RunSimulation {
  const sampleSize = Math.max(1, Math.floor(config.sampleSize));
  const floors = Math.max(1, Math.floor(config.maxFloors ?? DEFAULT_FLOORS));

  const runs: SimulatedRun[] = [];
  for (let i = 0; i < sampleSize; i += 1) {
    runs.push(simulateSingleRun(config, i));
  }

  const clearedCount = runs.filter((run) => run.cleared).length;
  const avgFloorReached =
    runs.reduce((sum, run) => sum + run.floorReached, 0) / sampleSize;
  const avgRunDurationMs =
    runs.reduce((sum, run) => sum + run.runDurationMs, 0) / sampleSize;

  const deathCauseDistribution: Record<string, number> = {};
  const totalRarity: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  for (const run of runs) {
    deathCauseDistribution[run.deathCause] = (deathCauseDistribution[run.deathCause] ?? 0) + 1;
    totalRarity.common += run.rarityCounts.common;
    totalRarity.magic += run.rarityCounts.magic;
    totalRarity.rare += run.rarityCounts.rare;
  }

  const rarityDenominator = Math.max(
    1,
    totalRarity.common + totalRarity.magic + totalRarity.rare
  );
  const itemRarityDistribution: Record<string, number> = {
    common: Number((totalRarity.common / rarityDenominator).toFixed(4)),
    magic: Number((totalRarity.magic / rarityDenominator).toFixed(4)),
    rare: Number((totalRarity.rare / rarityDenominator).toFixed(4))
  };

  const hpCurveP50: number[] = [];
  const hpCurveP90: number[] = [];
  const floorDurationP50Ms: number[] = [];
  const floorDurationP90Ms: number[] = [];
  for (let floor = 0; floor < floors; floor += 1) {
    const hpSlice = runs.map((run) => run.hpByFloor[floor] ?? 0);
    const durationSlice = runs
      .map((run) => run.floorDurationsMs[floor] ?? 0)
      .filter((value) => value > 0);
    hpCurveP50.push(percentile(hpSlice, 0.5));
    hpCurveP90.push(percentile(hpSlice, 0.9));
    floorDurationP50Ms.push(Math.round(percentile(durationSlice, 0.5)));
    floorDurationP90Ms.push(Math.round(percentile(durationSlice, 0.9)));
  }

  return {
    clearRate: Number((clearedCount / sampleSize).toFixed(4)),
    avgFloorReached: Number(avgFloorReached.toFixed(3)),
    avgRunDurationMs: Math.round(avgRunDurationMs),
    hpCurveP50,
    hpCurveP90,
    deathCauseDistribution,
    itemRarityDistribution,
    pacing: {
      runDurationP50Ms: Math.round(percentile(runs.map((run) => run.runDurationMs), 0.5)),
      runDurationP90Ms: Math.round(percentile(runs.map((run) => run.runDurationMs), 0.9)),
      floorDurationP50Ms,
      floorDurationP90Ms
    }
  };
}
