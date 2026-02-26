import type { FloorConfig } from "./types";

const MAX_FLOOR = 5;

export function getFloorConfig(floor: number): FloorConfig {
  const normalized = Math.max(1, Math.min(MAX_FLOOR, Math.floor(floor)));
  const scaleIndex = normalized - 1;

  if (normalized === 5) {
    return {
      floorNumber: normalized,
      monsterHpMultiplier: 2,
      monsterDmgMultiplier: 1.6,
      monsterCount: 1,
      clearThreshold: 1,
      isBossFloor: true
    };
  }

  return {
    floorNumber: normalized,
    monsterHpMultiplier: 1 + scaleIndex * 0.25,
    monsterDmgMultiplier: 1 + scaleIndex * 0.15,
    monsterCount: 12 + scaleIndex * 2,
    clearThreshold: 0.7,
    isBossFloor: false
  };
}
