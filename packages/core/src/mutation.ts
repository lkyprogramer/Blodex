import type { MetaProgression, MutationDef, MutationEffect } from "./contracts/types";

const MIN_MUTATION_SLOTS = 1;
const MAX_MUTATION_SLOTS = 3;

export type MutationDefMap = Record<string, MutationDef>;

export type MutationSelectionValidation =
  | {
      ok: true;
      selected: string[];
    }
  | {
      ok: false;
      reason: string;
    };

export type MutationUnlockResult =
  | {
      ok: true;
      meta: MetaProgression;
    }
  | {
      ok: false;
      meta: MetaProgression;
      reason: string;
    };

export function clampMutationSlots(input: number): number {
  return Math.max(MIN_MUTATION_SLOTS, Math.min(MAX_MUTATION_SLOTS, Math.floor(input)));
}

export function buildMutationDefMap(defs: MutationDef[]): MutationDefMap {
  return Object.fromEntries(defs.map((entry) => [entry.id, entry]));
}

export function collectAutoUnlockedMutationIds(
  meta: Pick<MetaProgression, "blueprintForgedIds">,
  defs: MutationDef[]
): string[] {
  const forged = new Set(meta.blueprintForgedIds);
  const unlocked: string[] = [];
  for (const mutation of defs) {
    if (mutation.unlock.type === "default") {
      unlocked.push(mutation.id);
      continue;
    }
    if (mutation.unlock.type === "blueprint" && forged.has(mutation.unlock.blueprintId)) {
      unlocked.push(mutation.id);
    }
  }
  return unlocked;
}

export function collectUnlockedMutationIds(meta: MetaProgression, defs: MutationDef[]): string[] {
  const unlocked = new Set<string>(meta.mutationUnlockedIds);
  for (const mutationId of collectAutoUnlockedMutationIds(meta, defs)) {
    unlocked.add(mutationId);
  }
  return [...unlocked.values()];
}

export function validateMutationSelection(
  selected: string[],
  defs: MutationDefMap,
  slots: number,
  unlockedIds: string[]
): MutationSelectionValidation {
  const normalizedSlots = clampMutationSlots(slots);
  const unlocked = new Set(unlockedIds);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const mutationId of selected) {
    if (seen.has(mutationId)) {
      continue;
    }
    const mutation = defs[mutationId];
    if (mutation === undefined) {
      return {
        ok: false,
        reason: `Mutation ${mutationId} not found.`
      };
    }
    if (!unlocked.has(mutationId)) {
      return {
        ok: false,
        reason: `Mutation ${mutationId} is not unlocked.`
      };
    }
    seen.add(mutationId);
    normalized.push(mutationId);
  }

  if (normalized.length > normalizedSlots) {
    return {
      ok: false,
      reason: `Mutation selection exceeds slot limit (${normalizedSlots}).`
    };
  }

  const selectedSet = new Set(normalized);
  for (const mutationId of normalized) {
    const mutation = defs[mutationId];
    if (mutation?.incompatibleWith === undefined) {
      continue;
    }
    for (const conflictId of mutation.incompatibleWith) {
      if (!selectedSet.has(conflictId)) {
        continue;
      }
      return {
        ok: false,
        reason: `Mutation conflict: ${mutationId} vs ${conflictId}.`
      };
    }
  }

  return {
    ok: true,
    selected: normalized
  };
}

export function normalizeMutationMetaState(meta: MetaProgression, defs: MutationDef[]): MetaProgression {
  const slots = clampMutationSlots(meta.mutationSlots);
  const unlocked = collectUnlockedMutationIds(meta, defs);
  const defMap = buildMutationDefMap(defs);
  const unlockedSet = new Set(unlocked);
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const mutationId of meta.selectedMutationIds) {
    if (selected.length >= slots || seen.has(mutationId)) {
      continue;
    }
    const candidate = defMap[mutationId];
    if (candidate === undefined || !unlockedSet.has(mutationId)) {
      continue;
    }
    const hasConflict = selected.some((selectedId) => {
      const selectedDef = defMap[selectedId];
      if (selectedDef === undefined) {
        return false;
      }
      return (
        (candidate.incompatibleWith ?? []).includes(selectedId) ||
        (selectedDef.incompatibleWith ?? []).includes(candidate.id)
      );
    });
    if (hasConflict) {
      continue;
    }
    selected.push(mutationId);
    seen.add(mutationId);
  }

  return {
    ...meta,
    mutationSlots: slots,
    mutationUnlockedIds: unlocked,
    selectedMutationIds: selected
  };
}

export function unlockEchoMutation(meta: MetaProgression, mutationDef: MutationDef): MutationUnlockResult {
  if (mutationDef.unlock.type !== "echo") {
    return {
      ok: false,
      meta,
      reason: `Mutation ${mutationDef.id} is not an echo unlock.`
    };
  }
  if (meta.mutationUnlockedIds.includes(mutationDef.id)) {
    return {
      ok: true,
      meta
    };
  }
  if (meta.echoes < mutationDef.unlock.cost) {
    return {
      ok: false,
      meta,
      reason: `Not enough echoes for ${mutationDef.id}.`
    };
  }
  return {
    ok: true,
    meta: {
      ...meta,
      echoes: meta.echoes - mutationDef.unlock.cost,
      mutationUnlockedIds: [...meta.mutationUnlockedIds, mutationDef.id]
    }
  };
}

export function collectActiveMutationEffects(selectedIds: string[], defs: MutationDefMap): MutationEffect[] {
  const effects: MutationEffect[] = [];
  const seen = new Set<string>();
  for (const mutationId of selectedIds) {
    if (seen.has(mutationId)) {
      continue;
    }
    seen.add(mutationId);
    const mutation = defs[mutationId];
    if (mutation === undefined) {
      continue;
    }
    effects.push(...mutation.effects);
  }
  return effects;
}

export function checkIncompatibleSymmetry(defs: MutationDef[]): Array<{ from: string; to: string }> {
  const byId = buildMutationDefMap(defs);
  const missingPairs: Array<{ from: string; to: string }> = [];
  for (const mutation of defs) {
    for (const conflictId of mutation.incompatibleWith ?? []) {
      const target = byId[conflictId];
      if (target === undefined) {
        continue;
      }
      if (!(target.incompatibleWith ?? []).includes(mutation.id)) {
        missingPairs.push({
          from: mutation.id,
          to: conflictId
        });
      }
    }
  }
  return missingPairs;
}
