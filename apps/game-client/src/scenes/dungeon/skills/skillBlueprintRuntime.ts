import type { BlueprintSkillAugment, SkillDef, SkillEffect } from "@blodex/core";
import { BLUEPRINT_DEF_MAP } from "@blodex/content";

function cloneSkillEffect(effect: SkillEffect): SkillEffect {
  if (typeof effect.value === "number") {
    return { ...effect };
  }
  return {
    ...effect,
    value: { ...effect.value }
  };
}

function applySingleSkillBlueprintAugment(skillDef: SkillDef, augment: BlueprintSkillAugment): SkillDef {
  const damageMultiplier = augment.damageMultiplier ?? 1;
  const cooldownMs =
    augment.cooldownMultiplier === undefined
      ? skillDef.cooldownMs
      : Math.max(100, Math.floor(skillDef.cooldownMs * augment.cooldownMultiplier));
  const manaCost =
    augment.manaCostFlat === undefined ? skillDef.manaCost : Math.max(0, skillDef.manaCost + augment.manaCostFlat);
  const range =
    augment.rangeMultiplier === undefined
      ? skillDef.range
      : Math.max(0.1, Number((skillDef.range * augment.rangeMultiplier).toFixed(2)));

  const effects = skillDef.effects.map((effect) => {
    let next = cloneSkillEffect(effect);
    if (augment.durationMultiplier !== undefined && next.duration !== undefined) {
      next = {
        ...next,
        duration: Math.max(100, Math.floor(next.duration * augment.durationMultiplier))
      };
    }
    if (damageMultiplier === 1 || next.type !== "damage") {
      return next;
    }
    if (typeof next.value === "number") {
      return {
        ...next,
        value: next.value * damageMultiplier
      };
    }
    return {
      ...next,
      value: {
        ...next.value,
        base: next.value.base * damageMultiplier,
        ratio: next.value.ratio * damageMultiplier
      }
    };
  });

  if (augment.appendedEffects !== undefined && augment.appendedEffects.length > 0) {
    effects.push(...augment.appendedEffects.map(cloneSkillEffect));
  }

  return {
    ...skillDef,
    cooldownMs,
    manaCost,
    range,
    effects
  };
}

export function applyForgedSkillBlueprintAugments(
  skillDef: SkillDef,
  forgedBlueprintIds: readonly string[] | undefined
): SkillDef {
  if (forgedBlueprintIds === undefined || forgedBlueprintIds.length === 0) {
    return skillDef;
  }

  let next = skillDef;
  for (const blueprintId of forgedBlueprintIds) {
    const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
    if (
      blueprint === undefined ||
      blueprint.category !== "skill" ||
      blueprint.unlockTargetId !== skillDef.id ||
      blueprint.skillAugment === undefined
    ) {
      continue;
    }
    next = applySingleSkillBlueprintAugment(next, blueprint.skillAugment);
  }
  return next;
}
