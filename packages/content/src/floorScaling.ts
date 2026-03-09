import type { FloorConfig } from "./types";
import { STORY_MAX_FLOOR } from "./config";

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

  if (storyFloor === STORY_MAX_FLOOR && normalized <= STORY_MAX_FLOOR) {
    return {
      floorNumber: storyFloor,
      monsterHpMultiplier: 2.5 * hpDifficultyScale,
      monsterDmgMultiplier: 1.85 * damageDifficultyScale,
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
      monsterHpMultiplier: 2.5 * endlessMultiplier * hpDifficultyScale,
      monsterDmgMultiplier: 1.85 * endlessMultiplier * damageDifficultyScale,
      monsterCount: 16 + Math.min(10, endlessDelta * 2),
      clearThreshold: 0.72,
      isBossFloor: false
    };
  }

  const storyMonsterCount =
    storyFloor <= 4 ? 12 + scaleIndex * 2 : 18 + Math.max(0, storyFloor - 5) * 2;
  return {
    floorNumber: storyFloor,
    monsterHpMultiplier: (1 + scaleIndex * 0.18) * hpDifficultyScale,
    monsterDmgMultiplier: (1 + scaleIndex * 0.12) * damageDifficultyScale,
    monsterCount: storyMonsterCount,
    clearThreshold: 0.7,
    isBossFloor: false
  };
}
