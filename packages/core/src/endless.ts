import type { FloorConfig, MetaProgression } from "./contracts/types";
import { resolveEndlessMutatorModifiers } from "./endlessMutator";
import type { RunState } from "./run";

export function endlessKillShardReward(floor: number, mutatorIds: readonly string[] = []): number {
  const base = Math.min(Math.max(0, Math.floor(floor)) * 2, 20);
  const modifiers = resolveEndlessMutatorModifiers(mutatorIds);
  return Math.max(1, Math.floor(base * (1 + modifiers.killShardBonusPercent)));
}

export function endlessFloorClearBonus(floor: number, mutatorIds: readonly string[] = []): number {
  const base = 8 + Math.max(0, Math.floor(floor));
  const modifiers = resolveEndlessMutatorModifiers(mutatorIds);
  return Math.max(0, Math.floor(base * (1 + modifiers.floorObolBonusPercent)));
}

export function resolveEndlessScalingMultiplier(floor: number): number {
  const normalized = Math.max(6, Math.floor(floor));
  return 1 + (normalized - 5) * 0.25;
}

export function resolveEndlessAffixBonusCount(floor: number, mutatorIds: readonly string[] = []): number {
  const normalized = Math.floor(floor);
  const modifiers = resolveEndlessMutatorModifiers(mutatorIds);
  if (normalized >= 10) {
    return 2 + modifiers.extraAffixCount;
  }
  if (normalized >= 8) {
    return 1 + modifiers.extraAffixCount;
  }
  return modifiers.extraAffixCount;
}

export function clampEndlessBlueprintDropBonus(bonusPercent: number): number {
  return Math.max(0, Math.min(0.2, bonusPercent));
}

export function toEndlessFloorConfig(baseConfig: FloorConfig, endlessFloor: number): FloorConfig {
  const multiplier = resolveEndlessScalingMultiplier(endlessFloor);
  return {
    ...baseConfig,
    floorNumber: Math.max(6, Math.floor(endlessFloor)),
    isBossFloor: false,
    monsterHpMultiplier: baseConfig.monsterHpMultiplier * multiplier,
    monsterDmgMultiplier: baseConfig.monsterDmgMultiplier * multiplier
  };
}

export function enterEndless(run: RunState): RunState {
  return {
    ...run,
    inEndless: true,
    endlessFloor: Math.max(1, run.endlessFloor + 1)
  };
}

export function advanceEndlessFloor(run: RunState): RunState {
  if (!run.inEndless) {
    return run;
  }
  return {
    ...run,
    endlessFloor: Math.max(1, run.endlessFloor + 1)
  };
}

export function recordEndlessBestFloor(meta: MetaProgression, endlessFloor: number): MetaProgression {
  const normalized = Math.max(0, Math.floor(endlessFloor));
  if (normalized <= meta.endlessBestFloor) {
    return meta;
  }
  return {
    ...meta,
    endlessBestFloor: normalized
  };
}
