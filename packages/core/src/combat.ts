import type { CombatEvent, MonsterState, PlayerState } from "./contracts/types";
import type { RngLike } from "./contracts/types";
import {
  clampSpecialAffixTotals,
  createEmptySpecialAffixTotals,
  type SpecialAffixTotals
} from "./specialAffix";

export interface CombatResolution {
  player: PlayerState;
  monster: MonsterState;
  events: CombatEvent[];
}

export interface PlayerAttackModifiers {
  damageMultiplier?: number;
  critChanceBonus?: number;
  critDamageMultiplier?: number;
  specialAffixTotals?: Partial<SpecialAffixTotals>;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

const DEFAULT_ARMOR_MITIGATION_K = 110;
const MIN_INCOMING_DAMAGE = 1;

export function resolveArmorMitigationRatio(armor: number, k = DEFAULT_ARMOR_MITIGATION_K): number {
  const normalizedArmor = Math.max(0, armor);
  const denominator = Math.max(1, normalizedArmor + Math.max(1, k));
  return clamp(normalizedArmor / denominator, 0, 0.95);
}

export function resolveMitigatedMonsterDamage(rawDamage: number, armor: number, k = DEFAULT_ARMOR_MITIGATION_K): number {
  const normalizedRawDamage = Math.max(0, rawDamage);
  const mitigationRatio = resolveArmorMitigationRatio(armor, k);
  return Math.max(MIN_INCOMING_DAMAGE, Math.floor(normalizedRawDamage * (1 - mitigationRatio)));
}

export function resolvePlayerAttack(
  player: PlayerState,
  monster: MonsterState,
  rng: RngLike,
  timestampMs: number,
  modifiers: PlayerAttackModifiers = {}
): CombatResolution {
  if (monster.health <= 0) {
    return { player, monster, events: [] };
  }

  const specialAffixTotals = clampSpecialAffixTotals(
    modifiers.specialAffixTotals ?? createEmptySpecialAffixTotals()
  );
  const critChance = clamp(player.derivedStats.critChance + (modifiers.critChanceBonus ?? 0), 0, 0.95);
  const damageMultiplier = Math.max(0.05, modifiers.damageMultiplier ?? 1);
  const critMultiplier = Math.max(1, (modifiers.critDamageMultiplier ?? 1.7) * (1 + specialAffixTotals.critDamage));
  const crit = rng.next() < critChance;
  const damage = Math.max(1, Math.floor(player.derivedStats.attackPower * damageMultiplier * (crit ? critMultiplier : 1)));
  const nextHealth = Math.max(0, monster.health - damage);
  const lifestealHeal =
    specialAffixTotals.lifesteal > 0 && damage > 0
      ? Math.floor(damage * specialAffixTotals.lifesteal)
      : 0;
  const nextPlayer =
    lifestealHeal > 0
      ? {
          ...player,
          health: Math.min(player.derivedStats.maxHealth, player.health + lifestealHeal)
        }
      : player;

  const events: CombatEvent[] = [
    {
      kind: crit ? "crit" : "damage",
      sourceId: player.id,
      targetId: monster.id,
      amount: damage,
      damageType: "physical",
      timestampMs
    }
  ];

  if (nextHealth === 0) {
    events.push({
      kind: "death",
      sourceId: player.id,
      targetId: monster.id,
      amount: damage,
      damageType: "physical",
      timestampMs
    });
  }

  return {
    player: nextPlayer,
    monster: {
      ...monster,
      health: nextHealth,
      aiState: nextHealth === 0 ? "dead" : monster.aiState
    },
    events
  };
}

export function resolveMonsterAttack(
  monster: MonsterState,
  player: PlayerState,
  rng: RngLike,
  timestampMs: number,
  specialAffixTotals?: Partial<SpecialAffixTotals>
): CombatResolution {
  if (player.health <= 0 || monster.health <= 0) {
    return { player, monster, events: [] };
  }

  const totals = clampSpecialAffixTotals(
    specialAffixTotals ?? createEmptySpecialAffixTotals()
  );
  const dodgeChance = clamp(totals.dodgeChance, 0, 0.75);
  if (rng.next() < dodgeChance) {
    return {
      player,
      monster,
      events: [
        {
          kind: "dodge",
          sourceId: monster.id,
          targetId: player.id,
          amount: 0,
          damageType: "physical",
          timestampMs
        }
      ]
    };
  }

  const mitigatedDamage = resolveMitigatedMonsterDamage(monster.damage, player.derivedStats.armor);
  const nextHealth = Math.max(0, player.health - mitigatedDamage);
  const reflectedDamage =
    totals.thorns > 0 && mitigatedDamage > 0 ? Math.max(1, Math.floor(mitigatedDamage * totals.thorns)) : 0;
  const nextMonsterHealth =
    reflectedDamage > 0 ? Math.max(1, monster.health - reflectedDamage) : monster.health;
  const appliedReflectedDamage = reflectedDamage > 0 ? monster.health - nextMonsterHealth : 0;

  const events: CombatEvent[] = [
    {
      kind: "damage",
      sourceId: monster.id,
      targetId: player.id,
      amount: mitigatedDamage,
      damageType: "physical",
      timestampMs
    }
  ];
  if (appliedReflectedDamage > 0) {
    events.push({
      kind: "damage",
      sourceId: player.id,
      targetId: monster.id,
      amount: appliedReflectedDamage,
      damageType: "physical",
      timestampMs
    });
  }

  if (nextHealth === 0) {
    events.push({
      kind: "death",
      sourceId: monster.id,
      targetId: player.id,
      amount: mitigatedDamage,
      damageType: "physical",
      timestampMs
    });
  }

  return {
    player: {
      ...player,
      health: nextHealth
    },
    monster: {
      ...monster,
      health: nextMonsterHealth,
      aiState: monster.aiState
    },
    events
  };
}
