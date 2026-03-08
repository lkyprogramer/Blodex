import type { ItemInstance } from "./contracts/types";
import { normalizeDerivedAffixValue } from "./itemAffix";
import {
  DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET,
  type ItemTradeoffCalibrationAsset
} from "./itemTradeoffCalibration";

export type ItemTradeoffCategory = "offense" | "defense" | "utility";

export interface ItemTradeoffCategoryScores {
  offense: number;
  defense: number;
  utility: number;
}

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

export function calculateItemCategoryScores(
  item: ItemInstance | undefined,
  calibration: ItemTradeoffCalibrationAsset = DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET
): ItemTradeoffCategoryScores {
  const scores = emptyScores();
  if (item === undefined) {
    return scores;
  }

  for (const [key, value] of collectItemAffixMap(item)) {
    const config = calibration.weights[key];
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

export function calculateItemPowerScore(
  item: ItemInstance | undefined,
  calibration: ItemTradeoffCalibrationAsset = DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET
): number {
  const scores = calculateItemCategoryScores(item, calibration);
  return Number((scores.offense + scores.defense + scores.utility).toFixed(4));
}
