import type {
  BuffInstance,
  CombatEvent,
  MonsterState,
  PlayerState,
  SkillArchetype,
  RngLike,
  SkillDef,
  SkillEffect,
  SkillOfferWeightContext,
  SkillInstance,
  PlayerSkillState,
  SkillResolution
} from "./contracts/types";
import {
  clampSpecialAffixTotals,
  createEmptySpecialAffixTotals,
  type SpecialAffixTotals
} from "./specialAffix";

function resolveScalingValue(effect: SkillEffect, player: PlayerState): number {
  if (typeof effect.value === "number") {
    return effect.value;
  }
  const stat = player.baseStats[effect.value.scaling];
  return effect.value.base + stat * effect.value.ratio;
}

function selectTargets(
  player: PlayerState,
  monsters: MonsterState[],
  def: SkillDef,
  rangeMultiplier = 1
): MonsterState[] {
  if (def.targeting === "self") {
    return [];
  }

  const living = monsters.filter((monster) => monster.health > 0);
  const effectiveRange = Math.max(0, def.range * Math.max(0, rangeMultiplier));
  const inRange = living.filter(
    (monster) =>
      Math.hypot(monster.position.x - player.position.x, monster.position.y - player.position.y) <= effectiveRange
  );

  if (def.targeting === "aoe_around") {
    return inRange;
  }

  const nearest = [...inRange].sort(
    (a, b) =>
      Math.hypot(a.position.x - player.position.x, a.position.y - player.position.y) -
      Math.hypot(b.position.x - player.position.x, b.position.y - player.position.y)
  )[0];

  return nearest === undefined ? [] : [nearest];
}

export interface ResolveSkillOptions {
  damageMultiplier?: number;
  specialAffixTotals?: Partial<SpecialAffixTotals>;
}

function clampSkillLevel(level: number): 1 | 2 | 3 {
  if (level <= 1) {
    return 1;
  }
  if (level >= 3) {
    return 3;
  }
  return 2;
}

function skillLevelEffectMultiplier(level: number): number {
  const normalized = clampSkillLevel(level);
  if (normalized === 2) {
    return 1.3;
  }
  if (normalized === 3) {
    return 1.6;
  }
  return 1;
}

function skillLevelCooldownMultiplier(level: number): number {
  const normalized = clampSkillLevel(level);
  if (normalized === 2) {
    return 0.9;
  }
  if (normalized === 3) {
    return 0.8;
  }
  return 1;
}

function statToArchetype(stat: SkillOfferWeightContext["strongestStat"]): SkillArchetype {
  if (stat === "strength") {
    return "warrior";
  }
  if (stat === "dexterity") {
    return "ranger";
  }
  return "arcanist";
}

export function canUseSkill(
  player: PlayerState,
  skillState: PlayerSkillState,
  skillDef: SkillDef,
  nowMs: number
): boolean {
  if (player.mana < skillDef.manaCost) {
    return false;
  }
  const readyAt = skillState.cooldowns[skillDef.id] ?? 0;
  return nowMs >= readyAt;
}

export function resolveSkill(
  player: PlayerState,
  targets: MonsterState[],
  skillDef: SkillDef,
  rng: RngLike,
  nowMs: number,
  options: ResolveSkillOptions = {}
): SkillResolution {
  const specialAffixTotals = clampSpecialAffixTotals(
    options.specialAffixTotals ?? createEmptySpecialAffixTotals()
  );
  const selectedTargets = selectTargets(player, targets, skillDef, 1 + specialAffixTotals.aoeRadius);
  const updatedMonsters = targets.map((monster) => ({ ...monster }));
  const events: CombatEvent[] = [];
  const buffsApplied: BuffInstance[] = [];

  let nextPlayer: PlayerState = {
    ...player,
    mana: Math.max(0, player.mana - skillDef.manaCost)
  };

  const skillDamageMultiplier = Math.max(0.05, options.damageMultiplier ?? 1);
  let totalDamageDealt = 0;
  for (const effect of skillDef.effects) {
    const resolved = resolveScalingValue(effect, player);

    if (effect.type === "damage") {
      for (const target of selectedTargets) {
        const idx = updatedMonsters.findIndex((monster) => monster.id === target.id);
        if (idx < 0) {
          continue;
        }
        const crit = rng.next() < nextPlayer.derivedStats.critChance;
        const critMultiplier = crit ? 1.5 * (1 + specialAffixTotals.critDamage) : 1;
        const amount = Math.max(
          1,
          Math.floor(resolved * skillDamageMultiplier * critMultiplier + specialAffixTotals.damageOverTime)
        );
        const nextHealth = Math.max(0, updatedMonsters[idx]!.health - amount);
        totalDamageDealt += amount;
        updatedMonsters[idx] = {
          ...updatedMonsters[idx]!,
          health: nextHealth,
          aiState: nextHealth <= 0 ? "dead" : updatedMonsters[idx]!.aiState
        };
        events.push({
          kind: crit ? "crit" : "damage",
          sourceId: player.id,
          targetId: target.id,
          amount,
          damageType: skillDef.damageType,
          timestampMs: nowMs
        });
        if (nextHealth <= 0) {
          events.push({
            kind: "death",
            sourceId: player.id,
            targetId: target.id,
            amount,
            damageType: skillDef.damageType,
            timestampMs: nowMs
          });
        }
      }
      continue;
    }

    if (effect.type === "heal") {
      const heal = Math.max(1, Math.floor(resolved));
      nextPlayer = {
        ...nextPlayer,
        health: Math.min(nextPlayer.derivedStats.maxHealth, nextPlayer.health + heal)
      };
      continue;
    }

    if ((effect.type === "buff" || effect.type === "debuff") && effect.buffId !== undefined) {
      const duration = effect.duration ?? 1000;
      const targetId = effect.type === "buff" ? player.id : selectedTargets[0]?.id;
      if (targetId !== undefined) {
        buffsApplied.push({
          defId: effect.buffId,
          sourceId: player.id,
          targetId,
          appliedAtMs: nowMs,
          expiresAtMs: nowMs + duration
        });
      }
    }
  }

  if (specialAffixTotals.lifesteal > 0 && totalDamageDealt > 0) {
    const healAmount = Math.floor(totalDamageDealt * specialAffixTotals.lifesteal);
    if (healAmount > 0) {
      nextPlayer = {
        ...nextPlayer,
        health: Math.min(nextPlayer.derivedStats.maxHealth, nextPlayer.health + healAmount)
      };
    }
  }

  return {
    player: nextPlayer,
    affectedMonsters: updatedMonsters,
    events,
    buffsApplied
  };
}

export function updateCooldowns(skillState: PlayerSkillState, nowMs: number): PlayerSkillState {
  const cooldowns: Record<string, number> = {};
  for (const [skillId, readyAt] of Object.entries(skillState.cooldowns)) {
    if (readyAt > nowMs) {
      cooldowns[skillId] = readyAt;
    }
  }
  return {
    ...skillState,
    cooldowns
  };
}

export function markSkillUsed(
  skillState: PlayerSkillState,
  skillDef: SkillDef,
  nowMs: number,
  options?: {
    cooldownReduction?: number;
  }
): PlayerSkillState {
  const cooldownReduction = Math.min(0.75, Math.max(0, options?.cooldownReduction ?? 0));
  const cooldownMs = Math.max(300, Math.floor(skillDef.cooldownMs * (1 - cooldownReduction)));
  return {
    ...skillState,
    cooldowns: {
      ...skillState.cooldowns,
      [skillDef.id]: nowMs + cooldownMs
    }
  };
}

export function createSkillDefForLevel(skillDef: SkillDef, level: number): SkillDef {
  const effectScale = skillLevelEffectMultiplier(level);
  const cooldownScale = skillLevelCooldownMultiplier(level);

  return {
    ...skillDef,
    cooldownMs: Math.max(100, Math.floor(skillDef.cooldownMs * cooldownScale)),
    effects: skillDef.effects.map((effect) => {
      if (typeof effect.value === "number") {
        return {
          ...effect,
          value: effect.value * effectScale
        };
      }
      return {
        ...effect,
        value: {
          ...effect.value,
          base: effect.value.base * effectScale,
          ratio: effect.value.ratio * effectScale
        }
      };
    })
  };
}

export function assignSkillToSlot(
  skillState: PlayerSkillState,
  skill: SkillInstance,
  slotIndex?: number
): PlayerSkillState {
  const slots = [...skillState.skillSlots];
  if (slotIndex !== undefined && slotIndex >= 0 && slotIndex < slots.length) {
    slots[slotIndex] = skill;
    return {
      ...skillState,
      skillSlots: slots
    };
  }

  const firstEmpty = slots.findIndex((entry) => entry === null);
  if (firstEmpty >= 0) {
    slots[firstEmpty] = skill;
    return {
      ...skillState,
      skillSlots: slots
    };
  }

  slots[0] = skill;
  return {
    ...skillState,
    skillSlots: slots
  };
}

export function pickSkillChoices(pool: SkillDef[], rng: RngLike, count = 3): SkillDef[] {
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const remaining = [...sorted];
  const picked: SkillDef[] = [];

  while (picked.length < count && remaining.length > 0) {
    const idx = rng.nextInt(0, remaining.length - 1);
    const selected = remaining.splice(idx, 1)[0];
    if (selected !== undefined) {
      picked.push(selected);
    }
  }

  return picked;
}

export function computeSkillOfferWeight(skill: SkillDef, context: SkillOfferWeightContext): number {
  const preferredArchetype = statToArchetype(context.strongestStat);
  const sameArchetype = skill.archetype !== undefined && skill.archetype === preferredArchetype;
  const owned = context.ownedSkillIds.includes(skill.id);
  let weight = sameArchetype ? 2 : 1;
  if (owned) {
    weight *= 0.5;
  }
  return Math.max(0.01, weight);
}

export function pickSkillChoicesWeighted(
  pool: SkillDef[],
  rng: RngLike,
  context: SkillOfferWeightContext,
  count = 3
): SkillDef[] {
  const remaining = [...pool].sort((left, right) => left.id.localeCompare(right.id));
  const picked: SkillDef[] = [];

  while (picked.length < count && remaining.length > 0) {
    const weighted = remaining.map((skill) => ({
      skill,
      weight: computeSkillOfferWeight(skill, context)
    }));
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * totalWeight;
    let chosenIndex = weighted.length - 1;
    for (let index = 0; index < weighted.length; index += 1) {
      roll -= weighted[index]!.weight;
      if (roll <= 0) {
        chosenIndex = index;
        break;
      }
    }
    const [selected] = remaining.splice(chosenIndex, 1);
    if (selected !== undefined) {
      picked.push(selected);
    }
  }

  return picked;
}
