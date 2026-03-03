import type {
  ItemInstance,
  ItemSpecialAffixKey,
  MetaProgression,
  MutationDef,
  SynergyCondition,
  SynergyDef,
  SynergyEffect,
  WeaponType
} from "./contracts/types";

export interface ActiveSkillSnapshot {
  id: string;
  level: number;
}

export interface SynergyRuntimeContext {
  weaponType: WeaponType;
  activeSkills: ActiveSkillSnapshot[];
  talentPoints: Record<string, number>;
  selectedMutationIds: string[];
  equipment: Array<ItemInstance | undefined>;
}

export interface SynergyRuntimeEffects {
  activeSynergyIds: string[];
  skillDamagePercent: Record<string, number>;
  skillModifiers: Record<string, Partial<Record<"radius" | "duration" | "manaCost", number>>>;
  statPercent: Record<string, number>;
  cooldownOverridesMs: Record<string, number>;
}

function emptyRuntimeEffects(): SynergyRuntimeEffects {
  return {
    activeSynergyIds: [],
    skillDamagePercent: {},
    skillModifiers: {},
    statPercent: {},
    cooldownOverridesMs: {}
  };
}

function resolveHighestSpecialAffix(
  equipment: Array<ItemInstance | undefined>,
  key: ItemSpecialAffixKey
): number {
  let highest = 0;
  for (const item of equipment) {
    if (item?.rolledSpecialAffixes === undefined) {
      continue;
    }
    highest = Math.max(highest, item.rolledSpecialAffixes[key] ?? 0);
  }
  return highest;
}

export function isSynergyConditionMet(condition: SynergyCondition, context: SynergyRuntimeContext): boolean {
  if (condition.type === "weapon_type") {
    return context.weaponType === condition.value;
  }
  if (condition.type === "skill_equipped") {
    return context.activeSkills.some((skill) => skill.id === condition.value);
  }
  if (condition.type === "skill_level_at_least") {
    return context.activeSkills.some(
      (skill) => skill.id === condition.skillId && skill.level >= condition.level
    );
  }
  if (condition.type === "talent_rank_at_least") {
    return (context.talentPoints[condition.talentId] ?? 0) >= condition.rank;
  }
  if (condition.type === "mutation_equipped") {
    return context.selectedMutationIds.includes(condition.value);
  }
  return resolveHighestSpecialAffix(context.equipment, condition.key) >= condition.value;
}

export function isSynergyActive(def: SynergyDef, context: SynergyRuntimeContext): boolean {
  return def.conditions.every((condition) => isSynergyConditionMet(condition, context));
}

export function collectActiveSynergies(defs: SynergyDef[], context: SynergyRuntimeContext): SynergyDef[] {
  return defs.filter((def) => isSynergyActive(def, context));
}

function applySynergyEffect(state: SynergyRuntimeEffects, effect: SynergyEffect): void {
  if (effect.type === "skill_damage_percent") {
    state.skillDamagePercent[effect.skillId] = (state.skillDamagePercent[effect.skillId] ?? 0) + effect.value;
    return;
  }
  if (effect.type === "skill_modifier") {
    const current = state.skillModifiers[effect.skillId] ?? {};
    current[effect.key] = (current[effect.key] ?? 0) + effect.value;
    state.skillModifiers[effect.skillId] = current;
    return;
  }
  if (effect.type === "stat_percent") {
    state.statPercent[effect.stat] = (state.statPercent[effect.stat] ?? 0) + effect.value;
    return;
  }
  const previous = state.cooldownOverridesMs[effect.key];
  if (previous === undefined) {
    state.cooldownOverridesMs[effect.key] = effect.valueMs;
    return;
  }
  state.cooldownOverridesMs[effect.key] = Math.min(previous, effect.valueMs);
}

export function resolveSynergyRuntimeEffects(
  defs: SynergyDef[],
  context: SynergyRuntimeContext
): SynergyRuntimeEffects {
  const runtime = emptyRuntimeEffects();
  for (const def of collectActiveSynergies(defs, context)) {
    runtime.activeSynergyIds.push(def.id);
    for (const effect of def.effects) {
      applySynergyEffect(runtime, effect);
    }
  }
  return runtime;
}

export function mergeSynergyDiscoveries(meta: MetaProgression, activeSynergyIds: string[]): MetaProgression {
  if (activeSynergyIds.length === 0) {
    return meta;
  }
  const known = new Set(meta.synergyDiscoveredIds);
  let changed = false;
  for (const id of activeSynergyIds) {
    if (known.has(id)) {
      continue;
    }
    known.add(id);
    changed = true;
  }
  if (!changed) {
    return meta;
  }
  return {
    ...meta,
    synergyDiscoveredIds: [...known.values()]
  };
}

export function collectMutationIds(defs: MutationDef[]): string[] {
  return defs.map((def) => def.id);
}
