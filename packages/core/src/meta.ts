import type { MetaProgression, PermanentUpgrade, RunSummary, UnlockDef } from "./contracts/types";
import type { RunState } from "./run";

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
    schemaVersion: 2,
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
    return {
      runsPlayed: asNumber(raw.runsPlayed, 0),
      bestFloor: asNumber(raw.bestFloor, 0),
      bestTimeMs: asNumber(raw.bestTimeMs, 0),
      soulShards: asNumber(raw.soulShards, 0),
      unlocks: Array.isArray(raw.unlocks) ? raw.unlocks.filter((entry): entry is string => typeof entry === "string") : [],
      schemaVersion: 2,
      permanentUpgrades: normalizePermanentUpgrades(raw.permanentUpgrades)
    };
  }

  return {
    runsPlayed: asNumber(raw.runsPlayed, 0),
    bestFloor: asNumber(raw.bestFloor, 0),
    bestTimeMs: asNumber(raw.bestTimeMs, 0),
    soulShards: 0,
    unlocks: [],
    schemaVersion: 2,
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
    return earned;
  }
  return Math.floor(earned * 0.5);
}

export function calculateObolReward(event: "monster_kill" | "floor_clear"): number {
  if (event === "monster_kill") {
    return 1;
  }
  return 5;
}

export function applyRunSummaryToMeta(meta: MetaProgression, summary: RunSummary): MetaProgression {
  const soulShardsEarned = summary.soulShardsEarned ?? 0;
  return {
    ...meta,
    soulShards: meta.soulShards + soulShardsEarned
  };
}

export function canPurchaseUnlock(meta: MetaProgression, unlock: UnlockDef): boolean {
  if (meta.unlocks.includes(unlock.id)) {
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
    unlocks: [...meta.unlocks, unlock.id]
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
