import type { ItemInstance } from "@blodex/core";

export type DeltaDirection = "up" | "down" | "equal";

export type EquipmentDeltaSummaryKey = "offense" | "defense" | "utility";

export interface EquipmentDeltaSummaryLine {
  key: EquipmentDeltaSummaryKey;
  direction: DeltaDirection;
  delta: number;
}

const CATEGORY_AFFIX_KEYS: Record<EquipmentDeltaSummaryKey, readonly string[]> = {
  offense: ["attackPower", "critChance", "critDamage", "attackSpeed", "aoeRadius", "damageOverTime", "lifesteal"],
  defense: ["maxHealth", "armor", "dodgeChance", "healthRegen", "thorns"],
  utility: ["maxMana", "moveSpeed", "xpBonus", "soulShardBonus", "cooldownReduction"]
};

function collectItemAffixMap(item: ItemInstance | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (item === undefined) {
    return map;
  }
  for (const [key, value] of Object.entries(item.rolledAffixes)) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(item.rolledSpecialAffixes ?? {})) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }
  return map;
}

export function resolveDeltaDirection(delta: number): DeltaDirection {
  if (delta > 0) {
    return "up";
  }
  if (delta < 0) {
    return "down";
  }
  return "equal";
}

export function buildEquipmentDeltaSummary(
  item: ItemInstance,
  compareItem: ItemInstance | undefined
): EquipmentDeltaSummaryLine[] {
  const currentAffixes = collectItemAffixMap(item);
  const compareAffixes = collectItemAffixMap(compareItem);

  return (Object.keys(CATEGORY_AFFIX_KEYS) as EquipmentDeltaSummaryKey[]).map((key) => {
    const delta = CATEGORY_AFFIX_KEYS[key].reduce((sum, affixKey) => {
      return sum + (currentAffixes.get(affixKey) ?? 0) - (compareAffixes.get(affixKey) ?? 0);
    }, 0);

    return {
      key,
      direction: resolveDeltaDirection(delta),
      delta
    };
  });
}
