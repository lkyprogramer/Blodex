import type { DerivedStats } from "./contracts/types";

export function normalizeDerivedAffixValue(key: keyof DerivedStats, value: number): number {
  if (key === "critChance") {
    // Backward compatibility: legacy saves may still store percent points (e.g. 2 => 2%).
    return value >= 1 ? value / 100 : value;
  }
  return value;
}
