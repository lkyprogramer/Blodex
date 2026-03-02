import type {
  BuffInstance,
  CombatEvent,
  MonsterState,
  PlayerState,
  RngLike,
  SkillDef,
  SkillEffect,
  SkillInstance,
  PlayerSkillState,
  SkillResolution
} from "./contracts/types";

function resolveScalingValue(effect: SkillEffect, player: PlayerState): number {
  if (typeof effect.value === "number") {
    return effect.value;
  }
  const stat = player.baseStats[effect.value.scaling];
  return effect.value.base + stat * effect.value.ratio;
}

function selectTargets(player: PlayerState, monsters: MonsterState[], def: SkillDef): MonsterState[] {
  if (def.targeting === "self") {
    return [];
  }

  const living = monsters.filter((monster) => monster.health > 0);
  const inRange = living.filter(
    (monster) => Math.hypot(monster.position.x - player.position.x, monster.position.y - player.position.y) <= def.range
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
  const selectedTargets = selectTargets(player, targets, skillDef);
  const updatedMonsters = targets.map((monster) => ({ ...monster }));
  const events: CombatEvent[] = [];
  const buffsApplied: BuffInstance[] = [];

  let nextPlayer: PlayerState = {
    ...player,
    mana: Math.max(0, player.mana - skillDef.manaCost)
  };

  const skillDamageMultiplier = Math.max(0.05, options.damageMultiplier ?? 1);
  for (const effect of skillDef.effects) {
    const resolved = resolveScalingValue(effect, player);

    if (effect.type === "damage") {
      for (const target of selectedTargets) {
        const idx = updatedMonsters.findIndex((monster) => monster.id === target.id);
        if (idx < 0) {
          continue;
        }
        const crit = rng.next() < nextPlayer.derivedStats.critChance;
        const amount = Math.max(1, Math.floor(resolved * skillDamageMultiplier * (crit ? 1.5 : 1)));
        const nextHealth = Math.max(0, updatedMonsters[idx]!.health - amount);
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
  nowMs: number
): PlayerSkillState {
  return {
    ...skillState,
    cooldowns: {
      ...skillState.cooldowns,
      [skillDef.id]: nowMs + skillDef.cooldownMs
    }
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
