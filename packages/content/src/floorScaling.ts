import type { FloorConfig } from "./types";
import { STORY_MAX_FLOOR } from "./config";

export function getFloorConfig(
  floor: number,
  difficultyScale?: {
    monsterHealthMultiplier: number;
    monsterDamageMultiplier: number;
  },
  storyMaxFloor = STORY_MAX_FLOOR
): FloorConfig {
  const normalized = Math.max(1, Math.floor(floor));
  const resolvedStoryMaxFloor = Math.max(1, Math.floor(storyMaxFloor));
  const storyFloor = Math.min(resolvedStoryMaxFloor, normalized);
  const scaleIndex = storyFloor - 1;
  const hpDifficultyScale = difficultyScale?.monsterHealthMultiplier ?? 1;
  const damageDifficultyScale = difficultyScale?.monsterDamageMultiplier ?? 1;
  const isLongRun = resolvedStoryMaxFloor > 5;
  const likelyNightmare = hpDifficultyScale >= 1.4 || damageDifficultyScale >= 1.35;

  if (storyFloor === resolvedStoryMaxFloor && normalized <= resolvedStoryMaxFloor) {
    const bossHpBase = isLongRun ? (likelyNightmare ? 2.45 : 2.95) : 2.5;
    const bossDmgBase = isLongRun ? (likelyNightmare ? 2.05 : 2.45) : 1.85;
    return {
      floorNumber: storyFloor,
      monsterHpMultiplier: bossHpBase * hpDifficultyScale,
      monsterDmgMultiplier: bossDmgBase * damageDifficultyScale,
      monsterCount: 1,
      clearThreshold: 1,
      isBossFloor: true
    };
  }

  if (normalized > resolvedStoryMaxFloor) {
    const endlessDelta = normalized - resolvedStoryMaxFloor;
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

  const storyMonsterCountBase =
    storyFloor <= 4 ? 12 + scaleIndex * 2 : 18 + Math.max(0, storyFloor - 5) * 2;
  const lateFloorAdjustment =
    isLongRun
      ? likelyNightmare
        ? storyFloor <= 2
          ? {
              hpMultiplier: 0.82,
              damageMultiplier: 0.82,
              monsterCountBonus: -2
            }
          : storyFloor <= 4
            ? {
                hpMultiplier: 0.86,
                damageMultiplier: 0.86,
                monsterCountBonus: -1
              }
            : storyFloor <= 6
              ? {
                  hpMultiplier: 0.92,
                  damageMultiplier: 0.9,
                  monsterCountBonus: -1
                }
              : {
                  hpMultiplier: 0.98,
                  damageMultiplier: 0.95,
                  monsterCountBonus: 0
                }
        : storyFloor >= 5
          ? {
              hpMultiplier: storyFloor >= 7 ? 1.04 : 1,
              damageMultiplier: storyFloor >= 7 ? 1.34 : 1.22,
              monsterCountBonus: 0
            }
          : {
              hpMultiplier: 1,
              damageMultiplier: 1,
              monsterCountBonus: 0
            }
      : {
          hpMultiplier: 1,
          damageMultiplier: 1,
          monsterCountBonus: 0
        };
  return {
    floorNumber: storyFloor,
    monsterHpMultiplier: (1 + scaleIndex * 0.18) * lateFloorAdjustment.hpMultiplier * hpDifficultyScale,
    monsterDmgMultiplier: (1 + scaleIndex * 0.12) * lateFloorAdjustment.damageMultiplier * damageDifficultyScale,
    monsterCount: storyMonsterCountBase + lateFloorAdjustment.monsterCountBonus,
    clearThreshold: 0.7,
    isBossFloor: false
  };
}
