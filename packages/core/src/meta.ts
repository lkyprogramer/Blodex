import type {
  DailyHistoryEntry,
  MetaProgression,
  PermanentUpgrade,
  RunSummary,
  UnlockDef
} from "./contracts/types";
import type { RunState } from "./run";
import {
  createInitialDifficultyCompletions,
  DEFAULT_DIFFICULTY,
  normalizeDifficultyCompletions,
  normalizeDifficultyMode,
  registerDifficultyVictory,
  resolveSelectedDifficulty
} from "./difficulty";
import {
  derivePermanentUpgradesFromTalents,
  estimateLegacyShardsSpentFromTalents,
  mapLegacyPermanentUpgradesToTalents,
  normalizeTalentPoints
} from "./talent";

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

function normalizeUnlocks(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((entry): entry is string => typeof entry === "string");
}

function normalizeTotalShardsSpent(input: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(asNumber(input, fallback)));
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const next: string[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string" || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    next.push(entry);
  }
  return next;
}

function isDailyDateKey(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function normalizeDailyDateKeys(input: unknown): string[] {
  return normalizeStringArray(input).filter((entry) => isDailyDateKey(entry));
}

function normalizeDailyHistory(input: unknown): DailyHistoryEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized: DailyHistoryEntry[] = [];
  for (const entry of input) {
    if (!isRecord(entry) || typeof entry.date !== "string" || !isDailyDateKey(entry.date)) {
      continue;
    }
    normalized.push({
      date: entry.date,
      score: Math.max(0, Math.floor(asNumber(entry.score, 0))),
      floorReached: Math.max(0, Math.floor(asNumber(entry.floorReached, 0))),
      kills: Math.max(0, Math.floor(asNumber(entry.kills, 0))),
      clearTimeMs: Math.max(0, Math.floor(asNumber(entry.clearTimeMs, 0))),
      challengeSuccessCount: Math.max(0, Math.floor(asNumber(entry.challengeSuccessCount, 0))),
      seed: typeof entry.seed === "string" ? entry.seed : "",
      rewarded: entry.rewarded === true
    });
  }
  normalized.sort((left, right) => left.date.localeCompare(right.date));
  const trimmed = normalized.slice(-30);
  return trimmed;
}

function clampMutationSlots(input: unknown, fallback = 1): number {
  const raw = Math.floor(asNumber(input, fallback));
  return Math.max(1, Math.min(3, raw));
}

function normalizeSelectedMutations(
  input: unknown,
  unlockedIds: string[],
  slots: number
): string[] {
  const unlocked = new Set(unlockedIds);
  const selected: string[] = [];
  for (const mutationId of normalizeStringArray(input)) {
    if (selected.length >= slots) {
      break;
    }
    if (!unlocked.has(mutationId)) {
      continue;
    }
    selected.push(mutationId);
  }
  return selected;
}

export function migrateMeta(raw: unknown): MetaProgression {
  const base: MetaProgression = {
    runsPlayed: 0,
    bestFloor: 0,
    bestTimeMs: 0,
    soulShards: 0,
    unlocks: [],
    cumulativeUnlockProgress: 0,
    schemaVersion: 5,
    selectedDifficulty: DEFAULT_DIFFICULTY,
    difficultyCompletions: createInitialDifficultyCompletions(),
    talentPoints: {},
    totalShardsSpent: 0,
    blueprintFoundIds: [],
    blueprintForgedIds: [],
    echoes: 0,
    mutationSlots: 1,
    mutationUnlockedIds: [],
    selectedMutationIds: [],
    synergyDiscoveredIds: [],
    endlessBestFloor: 0,
    dailyHistory: [],
    dailyRewardClaimedDates: [],
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
  const difficultyCompletions =
    schemaVersion >= 2
      ? normalizeDifficultyCompletions(raw.difficultyCompletions)
      : createInitialDifficultyCompletions();
  const selectedDifficulty = resolveSelectedDifficulty({
    selectedDifficulty:
      schemaVersion >= 2
        ? normalizeDifficultyMode(raw.selectedDifficulty, DEFAULT_DIFFICULTY)
        : DEFAULT_DIFFICULTY,
    difficultyCompletions
  });

  const synergyDiscoveredIds = normalizeStringArray(raw.synergyDiscoveredIds);
  const endlessBestFloor = Math.max(0, Math.floor(asNumber(raw.endlessBestFloor, 0)));
  const dailyHistory = normalizeDailyHistory(raw.dailyHistory);
  const dailyRewardClaimedDates = normalizeDailyDateKeys(raw.dailyRewardClaimedDates);

  if (schemaVersion >= 5) {
    const rawPermanentUpgrades = normalizePermanentUpgrades(raw.permanentUpgrades);
    let talentPoints = normalizeTalentPoints(raw.talentPoints);
    if (Object.keys(talentPoints).length === 0) {
      talentPoints = mapLegacyPermanentUpgradesToTalents(rawPermanentUpgrades);
    }
    const permanentUpgrades = derivePermanentUpgradesFromTalents(talentPoints);
    const totalShardsSpent = normalizeTotalShardsSpent(
      raw.totalShardsSpent,
      estimateLegacyShardsSpentFromTalents(talentPoints)
    );
    const blueprintFoundIds = normalizeStringArray(raw.blueprintFoundIds);
    const blueprintForgedIds = normalizeStringArray(raw.blueprintForgedIds);
    const mutationUnlockedIds = normalizeStringArray(raw.mutationUnlockedIds);
    const mutationSlots = clampMutationSlots(raw.mutationSlots, base.mutationSlots);
    const selectedMutationIds = normalizeSelectedMutations(raw.selectedMutationIds, mutationUnlockedIds, mutationSlots);

    return {
      runsPlayed: asNumber(raw.runsPlayed, 0),
      bestFloor: asNumber(raw.bestFloor, 0),
      bestTimeMs: asNumber(raw.bestTimeMs, 0),
      soulShards: asNumber(raw.soulShards, 0),
      unlocks: normalizeUnlocks(raw.unlocks),
      cumulativeUnlockProgress: asNumber(raw.cumulativeUnlockProgress, 0),
      schemaVersion: 5,
      selectedDifficulty,
      difficultyCompletions,
      talentPoints,
      totalShardsSpent,
      blueprintFoundIds,
      blueprintForgedIds,
      echoes: Math.max(0, Math.floor(asNumber(raw.echoes, 0))),
      mutationSlots,
      mutationUnlockedIds,
      selectedMutationIds,
      synergyDiscoveredIds,
      endlessBestFloor,
      dailyHistory,
      dailyRewardClaimedDates,
      permanentUpgrades
    };
  }

  if (schemaVersion >= 4) {
    const rawPermanentUpgrades = normalizePermanentUpgrades(raw.permanentUpgrades);
    let talentPoints = normalizeTalentPoints(raw.talentPoints);
    if (Object.keys(talentPoints).length === 0) {
      talentPoints = mapLegacyPermanentUpgradesToTalents(rawPermanentUpgrades);
    }
    const permanentUpgrades = derivePermanentUpgradesFromTalents(talentPoints);
    const totalShardsSpent = normalizeTotalShardsSpent(
      raw.totalShardsSpent,
      estimateLegacyShardsSpentFromTalents(talentPoints)
    );
    const blueprintFoundIds = normalizeStringArray(raw.blueprintFoundIds);
    const blueprintForgedIds = normalizeStringArray(raw.blueprintForgedIds);
    const mutationUnlockedIds = normalizeStringArray(raw.mutationUnlockedIds);
    const mutationSlots = clampMutationSlots(raw.mutationSlots, base.mutationSlots);
    const selectedMutationIds = normalizeSelectedMutations(raw.selectedMutationIds, mutationUnlockedIds, mutationSlots);

    return {
      runsPlayed: asNumber(raw.runsPlayed, 0),
      bestFloor: asNumber(raw.bestFloor, 0),
      bestTimeMs: asNumber(raw.bestTimeMs, 0),
      soulShards: asNumber(raw.soulShards, 0),
      unlocks: normalizeUnlocks(raw.unlocks),
      cumulativeUnlockProgress: asNumber(raw.cumulativeUnlockProgress, 0),
      schemaVersion: 5,
      selectedDifficulty,
      difficultyCompletions,
      talentPoints,
      totalShardsSpent,
      blueprintFoundIds,
      blueprintForgedIds,
      echoes: Math.max(0, Math.floor(asNumber(raw.echoes, 0))),
      mutationSlots,
      mutationUnlockedIds,
      selectedMutationIds,
      synergyDiscoveredIds,
      endlessBestFloor,
      dailyHistory,
      dailyRewardClaimedDates,
      permanentUpgrades
    };
  }

  if (schemaVersion >= 3) {
    const rawPermanentUpgrades = normalizePermanentUpgrades(raw.permanentUpgrades);
    let talentPoints = normalizeTalentPoints(raw.talentPoints);
    if (Object.keys(talentPoints).length === 0) {
      talentPoints = mapLegacyPermanentUpgradesToTalents(rawPermanentUpgrades);
    }
    const permanentUpgrades = derivePermanentUpgradesFromTalents(talentPoints);
    const totalShardsSpent = normalizeTotalShardsSpent(
      raw.totalShardsSpent,
      estimateLegacyShardsSpentFromTalents(talentPoints)
    );

    return {
      runsPlayed: asNumber(raw.runsPlayed, 0),
      bestFloor: asNumber(raw.bestFloor, 0),
      bestTimeMs: asNumber(raw.bestTimeMs, 0),
      soulShards: asNumber(raw.soulShards, 0),
      unlocks: normalizeUnlocks(raw.unlocks),
      cumulativeUnlockProgress: asNumber(raw.cumulativeUnlockProgress, 0),
      schemaVersion: 5,
      selectedDifficulty,
      difficultyCompletions,
      talentPoints,
      totalShardsSpent,
      blueprintFoundIds: [],
      blueprintForgedIds: [],
      echoes: 0,
      mutationSlots: 1,
      mutationUnlockedIds: [],
      selectedMutationIds: [],
      synergyDiscoveredIds: [],
      endlessBestFloor: 0,
      dailyHistory: [],
      dailyRewardClaimedDates: [],
      permanentUpgrades
    };
  }

  const rawPermanentUpgrades =
    schemaVersion >= 2
      ? normalizePermanentUpgrades(raw.permanentUpgrades)
      : {
          startingHealth: 0,
          startingArmor: 0,
          luckBonus: 0,
          skillSlots: 2,
          potionCharges: 0
        };
  const talentPoints = mapLegacyPermanentUpgradesToTalents(rawPermanentUpgrades);
  const permanentUpgrades = derivePermanentUpgradesFromTalents(talentPoints);
  const totalShardsSpent = estimateLegacyShardsSpentFromTalents(talentPoints);

  return {
    runsPlayed: asNumber(raw.runsPlayed, 0),
    bestFloor: asNumber(raw.bestFloor, 0),
    bestTimeMs: asNumber(raw.bestTimeMs, 0),
    soulShards: schemaVersion >= 2 ? asNumber(raw.soulShards, 0) : 0,
    unlocks: schemaVersion >= 2 ? normalizeUnlocks(raw.unlocks) : [],
    cumulativeUnlockProgress: schemaVersion >= 2 ? asNumber(raw.cumulativeUnlockProgress, 0) : 0,
    schemaVersion: 5,
    selectedDifficulty,
    difficultyCompletions,
    talentPoints,
    totalShardsSpent,
    blueprintFoundIds: [],
    blueprintForgedIds: [],
    echoes: 0,
    mutationSlots: 1,
    mutationUnlockedIds: [],
    selectedMutationIds: [],
    synergyDiscoveredIds: [],
    endlessBestFloor: 0,
    dailyHistory: [],
    dailyRewardClaimedDates: [],
    permanentUpgrades
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
    soulShards: meta.soulShards + soulShardsEarned,
    echoes: meta.echoes + 1
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
    cumulativeUnlockProgress: meta.cumulativeUnlockProgress + unlock.cost,
    totalShardsSpent: meta.totalShardsSpent + unlock.cost
  };

  if (unlock.effect.type !== "permanent_upgrade") {
    return next;
  }

  const legacyPermanentUpgrades: PermanentUpgrade = {
    ...next.permanentUpgrades,
    [unlock.effect.key]: next.permanentUpgrades[unlock.effect.key] + unlock.effect.value
  };
  const mappedLegacyTalents = mapLegacyPermanentUpgradesToTalents(legacyPermanentUpgrades);
  const nextTalentPoints = {
    ...next.talentPoints,
    ...mappedLegacyTalents
  };

  return {
    ...next,
    talentPoints: nextTalentPoints,
    permanentUpgrades: derivePermanentUpgradesFromTalents(nextTalentPoints)
  };
}

export function collectUnlockedBiomeIds(meta: MetaProgression, unlockDefs: UnlockDef[]): string[] {
  const set = new Set<string>([
    "forgotten_catacombs",
    "molten_caverns",
    "frozen_halls",
    "phantom_graveyard",
    "venom_swamp",
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
