import type { ItemInstance } from "./contracts/types";
import { normalizeDerivedAffixValue } from "./itemAffix";

export type ItemTradeoffCategory = "offense" | "defense" | "utility";

export interface ItemTradeoffCategoryScores {
  offense: number;
  defense: number;
  utility: number;
}

const AFFIX_TRADEOFF_WEIGHTS: Readonly<
  Record<string, { category: ItemTradeoffCategory; weight: number }>
> = {
  attackPower: { category: "offense", weight: 2.2 },
  critChance: { category: "offense", weight: 160 },
  critDamage: { category: "offense", weight: 120 },
  attackSpeed: { category: "offense", weight: 32 },
  aoeRadius: { category: "offense", weight: 90 },
  skillBonusDamage: { category: "offense", weight: 1.8 },
  lifesteal: { category: "offense", weight: 150 },
  maxHealth: { category: "defense", weight: 0.18 },
  armor: { category: "defense", weight: 1.35 },
  dodgeChance: { category: "defense", weight: 120 },
  healthRegen: { category: "defense", weight: 3 },
  thorns: { category: "defense", weight: 70 },
  maxMana: { category: "utility", weight: 0.18 },
  moveSpeed: { category: "utility", weight: 0.55 },
  xpBonus: { category: "utility", weight: 12 },
  soulShardBonus: { category: "utility", weight: 8 },
  cooldownReduction: { category: "utility", weight: 110 }
};

function emptyScores(): ItemTradeoffCategoryScores {
  return {
    offense: 0,
    defense: 0,
    utility: 0
  };
}

export function collectItemAffixMap(item: ItemInstance | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (item === undefined) {
    return map;
  }

  for (const [key, value] of Object.entries(item.rolledAffixes)) {
    if (value !== undefined) {
      map.set(key, normalizeDerivedAffixValue(key as keyof ItemInstance["rolledAffixes"], value));
    }
  }
  for (const [key, value] of Object.entries(item.rolledSpecialAffixes ?? {})) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }

  return map;
}

export function calculateItemCategoryScores(item: ItemInstance | undefined): ItemTradeoffCategoryScores {
  const scores = emptyScores();
  if (item === undefined) {
    return scores;
  }

  for (const [key, value] of collectItemAffixMap(item)) {
    const config = AFFIX_TRADEOFF_WEIGHTS[key];
    if (config === undefined) {
      continue;
    }
    scores[config.category] += value * config.weight;
  }

  return {
    offense: Number(scores.offense.toFixed(4)),
    defense: Number(scores.defense.toFixed(4)),
    utility: Number(scores.utility.toFixed(4))
  };
}

export function calculateItemPowerScore(item: ItemInstance | undefined): number {
  const scores = calculateItemCategoryScores(item);
  return Number((scores.offense + scores.defense + scores.utility).toFixed(4));
}
