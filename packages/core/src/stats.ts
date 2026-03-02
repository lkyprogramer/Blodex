import type {
  AggregatedBuffEffect,
  BaseStats,
  DerivedStats,
  ItemInstance,
  PermanentUpgrade
} from "./contracts/types";
import type { TalentEffectTotals } from "./talent";

function cloneDerived(stats: DerivedStats): DerivedStats {
  return {
    maxHealth: stats.maxHealth,
    maxMana: stats.maxMana,
    armor: stats.armor,
    attackPower: stats.attackPower,
    critChance: stats.critChance,
    attackSpeed: stats.attackSpeed,
    moveSpeed: stats.moveSpeed
  };
}

export function deriveStats(
  base: BaseStats,
  equippedItems: ItemInstance[],
  buffEffects?: AggregatedBuffEffect,
  permanentUpgrades?: PermanentUpgrade,
  talentEffects?: Pick<TalentEffectTotals, "derivedFlat" | "derivedPercent">
): DerivedStats {
  const upgrade = permanentUpgrades;
  const baseDerived: DerivedStats = {
    maxHealth: 100 + base.vitality * 18 + (upgrade?.startingHealth ?? 0),
    maxMana: 40 + base.intelligence * 10,
    armor: base.dexterity * 1.5 + (upgrade?.startingArmor ?? 0),
    attackPower: 8 + base.strength * 2.2,
    critChance: 0.03 + base.dexterity * 0.0015 + (upgrade?.luckBonus ?? 0),
    attackSpeed: 1 + base.dexterity * 0.002,
    moveSpeed: 140 + base.dexterity * 0.3
  };

  const next = cloneDerived(baseDerived);

  for (const item of equippedItems) {
    for (const [key, value] of Object.entries(item.rolledAffixes) as Array<[keyof DerivedStats, number | undefined]>) {
      if (value === undefined) {
        continue;
      }
      next[key] += value;
    }
  }

  if (talentEffects !== undefined) {
    for (const [key, value] of Object.entries(talentEffects.derivedFlat) as Array<
      [keyof DerivedStats, number]
    >) {
      next[key] += value;
    }
    for (const [key, value] of Object.entries(talentEffects.derivedPercent) as Array<
      [keyof Pick<DerivedStats, "attackPower" | "attackSpeed" | "moveSpeed" | "critChance">, number]
    >) {
      next[key] *= 1 + value;
    }
  }

  if (buffEffects !== undefined) {
    for (const [key, value] of Object.entries(buffEffects.additive) as Array<[keyof DerivedStats, number]>) {
      next[key] += value;
    }
    for (const [key, value] of Object.entries(buffEffects.multiplicative) as Array<[keyof DerivedStats, number]>) {
      next[key] *= value;
    }
    if (buffEffects.slowMultiplier !== undefined) {
      next.moveSpeed *= buffEffects.slowMultiplier;
    }
    if (buffEffects.guaranteedCrit) {
      next.critChance = Math.max(next.critChance, 1);
    }
  }

  next.maxHealth = Math.max(1, Math.floor(next.maxHealth));
  next.maxMana = Math.max(0, Math.floor(next.maxMana));
  next.armor = Math.max(0, Number(next.armor.toFixed(2)));
  next.attackPower = Math.max(1, Number(next.attackPower.toFixed(2)));
  next.attackSpeed = Math.max(0.2, Number(next.attackSpeed.toFixed(3)));
  next.moveSpeed = Math.max(40, Number(next.moveSpeed.toFixed(2)));
  next.critChance = buffEffects?.guaranteedCrit
    ? 1
    : Math.min(0.5, Math.max(0, next.critChance));

  return next;
}

export function defaultBaseStats(): BaseStats {
  return {
    strength: 8,
    dexterity: 8,
    vitality: 8,
    intelligence: 5
  };
}
