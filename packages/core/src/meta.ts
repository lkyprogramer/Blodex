import type { MetaProgression, PermanentUpgrade, RunSummary, UnlockDef } from "./contracts/types";
import type { RunState } from "./run";
import {
  createInitialDifficultyCompletions,
  DEFAULT_DIFFICULTY,
  normalizeDifficultyCompletions,
  normalizeDifficultyMode,
  registerDifficultyVictory,
  resolveSelectedDifficulty
} from "./difficulty";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(input: unknown, fallback = 0): number {
  return typeof input === "number" && Number.isFinite(input) ? input : fallback;
}

function normalizePermanentUpgrades(input: unknown): PermanentUpgrade {
  const base: PermanentUpgrade = {
    startingHealth: 0,
    startingArmor: 0,
    luckBonus: 0,
    skillSlots: 2,
    potionCharges: 0
  };
  if (!isRecord(input)) {
    return base;
  }

  return {
    startingHealth: asNumber(input.startingHealth, base.startingHealth),
    startingArmor: asNumber(input.startingArmor, base.startingArmor),
    luckBonus: asNumber(input.luckBonus, base.luckBonus),
    skillSlots: asNumber(input.skillSlots, base.skillSlots),
    potionCharges: asNumber(input.potionCharges, base.potionCharges)
  };
}

export function migrateMeta(raw: unknown): MetaProgression {
  const base: MetaProgression = {
    runsPlayed: 0,
    bestFloor: 0,
    bestTimeMs: 0,
    soulShards: 0,
    unlocks: [],
    cumulativeUnlockProgress: 0,
    schemaVersion: 2,
    selectedDifficulty: DEFAULT_DIFFICULTY,
    difficultyCompletions: createInitialDifficultyCompletions(),
    permanentUpgrades: {
      startingHealth: 0,
      startingArmor: 0,
      luckBonus: 0,
      skillSlots: 2,
      potionCharges: 0
    }
  };
  if (!isRecord(raw)) {
    return base;
  }

  const schemaVersion = asNumber(raw.schemaVersion, 1);
  if (schemaVersion >= 2) {
    const difficultyCompletions = normalizeDifficultyCompletions(raw.difficultyCompletions);
    const selectedDifficulty = normalizeDifficultyMode(raw.selectedDifficulty, DEFAULT_DIFFICULTY);
    return {
      runsPlayed: asNumber(raw.runsPlayed, 0),
      bestFloor: asNumber(raw.bestFloor, 0),
      bestTimeMs: asNumber(raw.bestTimeMs, 0),
      soulShards: asNumber(raw.soulShards, 0),
      unlocks: Array.isArray(raw.unlocks) ? raw.unlocks.filter((entry): entry is string => typeof entry === "string") : [],
      cumulativeUnlockProgress: asNumber(raw.cumulativeUnlockProgress, 0),
      schemaVersion: 2,
      selectedDifficulty: resolveSelectedDifficulty({
        selectedDifficulty,
        difficultyCompletions
      }),
      difficultyCompletions,
      permanentUpgrades: normalizePermanentUpgrades(raw.permanentUpgrades)
    };
  }

  return {
    runsPlayed: asNumber(raw.runsPlayed, 0),
    bestFloor: asNumber(raw.bestFloor, 0),
    bestTimeMs: asNumber(raw.bestTimeMs, 0),
    soulShards: 0,
    unlocks: [],
    cumulativeUnlockProgress: 0,
    schemaVersion: 2,
    selectedDifficulty: DEFAULT_DIFFICULTY,
    difficultyCompletions: createInitialDifficultyCompletions(),
    permanentUpgrades: {
      startingHealth: 0,
      startingArmor: 0,
      luckBonus: 0,
      skillSlots: 2,
      potionCharges: 0
    }
  };
}

export function calculateSoulShardReward(run: RunState, isVictory: boolean): number {
  const kills = Math.max(run.totalKills, run.kills);
  const killReward = kills;
  const floorReward = run.floorsCleared * 5;
  const bossReward = run.currentFloor >= 5 ? 20 : 0;
  const completionReward = isVictory ? 10 : 0;
  const earned = killReward + floorReward + bossReward + completionReward;
  if (isVictory) {
    return Math.floor(earned * run.difficultyModifier.soulShardMultiplier);
  }
  return Math.floor(earned * 0.5 * run.difficultyModifier.soulShardMultiplier);
}

export function calculateObolReward(event: "monster_kill" | "floor_clear"): number {
  if (event === "monster_kill") {
    return 1;
  }
  return 5;
}

export function applyRunSummaryToMeta(meta: MetaProgression, summary: RunSummary): MetaProgression {
  const soulShardsEarned = summary.soulShardsEarned ?? 0;
  let next: MetaProgression = {
    ...meta,
    soulShards: meta.soulShards + soulShardsEarned
  };
  if (summary.isVictory === true) {
    const completedDifficulty = normalizeDifficultyMode(summary.difficulty, DEFAULT_DIFFICULTY);
    next = registerDifficultyVictory(next, completedDifficulty);
  }
  return {
    ...next,
    selectedDifficulty: resolveSelectedDifficulty(next)
  };
}

export function canPurchaseUnlock(meta: MetaProgression, unlock: UnlockDef): boolean {
  if (meta.unlocks.includes(unlock.id)) {
    return false;
  }
  if (meta.cumulativeUnlockProgress < unlock.cumulativeRequirement) {
    return false;
  }
  return meta.soulShards >= unlock.cost;
}

export function purchaseUnlock(meta: MetaProgression, unlock: UnlockDef): MetaProgression {
  if (!canPurchaseUnlock(meta, unlock)) {
    return meta;
  }

  const next: MetaProgression = {
    ...meta,
    soulShards: meta.soulShards - unlock.cost,
    unlocks: [...meta.unlocks, unlock.id],
    cumulativeUnlockProgress: meta.cumulativeUnlockProgress + unlock.cost
  };

  if (unlock.effect.type !== "permanent_upgrade") {
    return next;
  }

  return {
    ...next,
    permanentUpgrades: {
      ...next.permanentUpgrades,
      [unlock.effect.key]: next.permanentUpgrades[unlock.effect.key] + unlock.effect.value
    }
  };
}

export function collectUnlockedBiomeIds(meta: MetaProgression, unlockDefs: UnlockDef[]): string[] {
  const set = new Set<string>([
    "forgotten_catacombs",
    "molten_caverns",
    "frozen_halls",
    "bone_throne"
  ]);
  for (const unlockId of meta.unlocks) {
    const unlock = unlockDefs.find((candidate) => candidate.id === unlockId);
    if (unlock?.effect.type === "biome_unlock") {
      set.add(unlock.effect.biomeId);
    }
  }
  return [...set];
}

export function collectUnlockedAffixIds(meta: MetaProgression, unlockDefs: UnlockDef[]): string[] {
  const set = new Set<string>();
  for (const unlockId of meta.unlocks) {
    const unlock = unlockDefs.find((candidate) => candidate.id === unlockId);
    if (unlock?.effect.type === "affix_unlock") {
      set.add(unlock.effect.affixId);
    }
  }
  return [...set];
}

export function collectUnlockedEventIds(meta: MetaProgression, unlockDefs: UnlockDef[]): string[] {
  const set = new Set<string>();
  for (const unlockId of meta.unlocks) {
    const unlock = unlockDefs.find((candidate) => candidate.id === unlockId);
    if (unlock?.effect.type === "event_unlock") {
      set.add(unlock.effect.eventId);
    }
  }
  return [...set];
}
