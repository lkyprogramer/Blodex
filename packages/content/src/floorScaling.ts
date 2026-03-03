import type { FloorConfig } from "./types";

const STORY_MAX_FLOOR = 5;

export function getFloorConfig(
  floor: number,
  difficultyScale?: {
    monsterHealthMultiplier: number;
    monsterDamageMultiplier: number;
  }
): FloorConfig {
  const normalized = Math.max(1, Math.floor(floor));
  const storyFloor = Math.min(STORY_MAX_FLOOR, normalized);
  const scaleIndex = storyFloor - 1;
  const hpDifficultyScale = difficultyScale?.monsterHealthMultiplier ?? 1;
  const damageDifficultyScale = difficultyScale?.monsterDamageMultiplier ?? 1;

  if (storyFloor === 5 && normalized <= STORY_MAX_FLOOR) {
    return {
      floorNumber: storyFloor,
      monsterHpMultiplier: 2 * hpDifficultyScale,
      monsterDmgMultiplier: 1.6 * damageDifficultyScale,
      monsterCount: 1,
      clearThreshold: 1,
      isBossFloor: true
    };
  }

  if (normalized > STORY_MAX_FLOOR) {
    const endlessDelta = normalized - STORY_MAX_FLOOR;
    const endlessMultiplier = 1 + endlessDelta * 0.25;
    return {
      floorNumber: normalized,
      monsterHpMultiplier: 2 * endlessMultiplier * hpDifficultyScale,
      monsterDmgMultiplier: 1.6 * endlessMultiplier * damageDifficultyScale,
      monsterCount: 16 + Math.min(10, endlessDelta * 2),
      clearThreshold: 0.72,
      isBossFloor: false
    };
  }

  return {
    floorNumber: storyFloor,
    monsterHpMultiplier: (1 + scaleIndex * 0.25) * hpDifficultyScale,
    monsterDmgMultiplier: (1 + scaleIndex * 0.15) * damageDifficultyScale,
    monsterCount: 12 + scaleIndex * 2,
    clearThreshold: 0.7,
    isBossFloor: false
  };
}
