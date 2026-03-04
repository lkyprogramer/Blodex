import type { RunState } from "./run";

export interface EndlessMutatorModifierSet {
  extraAffixCount: number;
  merchantPriceMultiplier: number;
  eventRiskChanceBonus: number;
  floorObolBonusPercent: number;
  killShardBonusPercent: number;
}

export interface EndlessMutatorDef {
  id: string;
  tier: 1 | 2 | 3;
  unlockFloor: number;
  name: string;
  description: string;
  modifiers: Partial<EndlessMutatorModifierSet>;
}

export const ENDLESS_MUTATOR_DEFS: readonly EndlessMutatorDef[] = [
  {
    id: "pack_hunt",
    tier: 1,
    unlockFloor: 8,
    name: "Pack Hunt",
    description: "Elite packs harden: extra affix pressure and richer floor bounty.",
    modifiers: {
      extraAffixCount: 1,
      floorObolBonusPercent: 0.1
    }
  },
  {
    id: "entropy_tax",
    tier: 2,
    unlockFloor: 11,
    name: "Entropy Tax",
    description: "Abyss taxes certainty: event risks rise and merchants overcharge.",
    modifiers: {
      merchantPriceMultiplier: 1.18,
      eventRiskChanceBonus: 0.12
    }
  },
  {
    id: "soul_siphon",
    tier: 3,
    unlockFloor: 14,
    name: "Soul Siphon",
    description: "Abyss siphons conflict into rewards: shard and obol payout surge.",
    modifiers: {
      killShardBonusPercent: 0.35,
      floorObolBonusPercent: 0.2
    }
  }
] as const;

const ENDLESS_MUTATOR_DEF_MAP = new Map<string, EndlessMutatorDef>(
  ENDLESS_MUTATOR_DEFS.map((entry) => [entry.id, entry])
);

export function resolveEndlessMutatorsForFloor(floor: number): EndlessMutatorDef[] {
  const normalized = Math.max(0, Math.floor(floor));
  return ENDLESS_MUTATOR_DEFS.filter((entry) => normalized >= entry.unlockFloor).map((entry) => ({ ...entry }));
}

export function getEndlessMutatorDef(mutatorId: string): EndlessMutatorDef | null {
  const entry = ENDLESS_MUTATOR_DEF_MAP.get(mutatorId);
  return entry === undefined ? null : { ...entry };
}

export function resolveEndlessMutatorModifiers(
  mutatorIds: readonly string[] | undefined
): EndlessMutatorModifierSet {
  const result: EndlessMutatorModifierSet = {
    extraAffixCount: 0,
    merchantPriceMultiplier: 1,
    eventRiskChanceBonus: 0,
    floorObolBonusPercent: 0,
    killShardBonusPercent: 0
  };

  if (mutatorIds === undefined || mutatorIds.length === 0) {
    return result;
  }

  for (const mutatorId of mutatorIds) {
    const def = ENDLESS_MUTATOR_DEF_MAP.get(mutatorId);
    if (def === undefined) {
      continue;
    }
    result.extraAffixCount += def.modifiers.extraAffixCount ?? 0;
    result.merchantPriceMultiplier *= def.modifiers.merchantPriceMultiplier ?? 1;
    result.eventRiskChanceBonus += def.modifiers.eventRiskChanceBonus ?? 0;
    result.floorObolBonusPercent += def.modifiers.floorObolBonusPercent ?? 0;
    result.killShardBonusPercent += def.modifiers.killShardBonusPercent ?? 0;
  }

  result.extraAffixCount = Math.max(0, Math.floor(result.extraAffixCount));
  result.merchantPriceMultiplier = Math.max(1, result.merchantPriceMultiplier);
  result.eventRiskChanceBonus = Math.max(0, result.eventRiskChanceBonus);
  result.floorObolBonusPercent = Math.max(0, result.floorObolBonusPercent);
  result.killShardBonusPercent = Math.max(0, result.killShardBonusPercent);
  return result;
}

export interface SyncEndlessMutatorResult {
  run: RunState;
  activatedIds: string[];
}

export function syncEndlessMutatorState(run: RunState): SyncEndlessMutatorResult {
  if (!run.inEndless) {
    return {
      run,
      activatedIds: []
    };
  }

  const unlocked = resolveEndlessMutatorsForFloor(run.currentFloor).map((entry) => entry.id);
  if (unlocked.length === 0) {
    const nextRun =
      run.mutatorActiveIds === undefined && run.mutatorState === undefined
        ? {
            ...run,
            mutatorActiveIds: [],
            mutatorState: {}
          }
        : run;
    return {
      run: nextRun,
      activatedIds: []
    };
  }

  const activeIds = [...(run.mutatorActiveIds ?? [])];
  const state = { ...(run.mutatorState ?? {}) };
  const activatedIds: string[] = [];
  for (const mutatorId of unlocked) {
    if (!activeIds.includes(mutatorId)) {
      activeIds.push(mutatorId);
      activatedIds.push(mutatorId);
    }
    if (state[mutatorId] === undefined) {
      state[mutatorId] = {
        activatedAtFloor: run.currentFloor
      };
    }
  }

  return {
    run: {
      ...run,
      mutatorActiveIds: activeIds,
      mutatorState: state
    },
    activatedIds
  };
}

export function describeEndlessMutator(mutatorId: string): string {
  const def = ENDLESS_MUTATOR_DEF_MAP.get(mutatorId);
  if (def === undefined) {
    return mutatorId;
  }
  return `${def.name} (F${def.unlockFloor})`;
}
