import type { FloorConfig } from "./types";
import { STORY_MAX_FLOOR } from "./config";

const DEFAULT_SPAWN_MIN_DISTANCE = 4;
const DEFAULT_SPAWN_MAX_DISTANCE = 30;
const DEFAULT_SPAWN_MIN_SPACING = 2;
const DEFAULT_SPAWN_PACK_RADIUS = 4.5;

function buildCombatFloorConfig(
  base: Pick<FloorConfig, "floorNumber" | "monsterHpMultiplier" | "monsterDmgMultiplier" | "monsterCount" | "clearThreshold">
): FloorConfig {
  return {
    ...base,
    isBossFloor: false,
    pacingKind: "combat",
    grantsFloorClearRewards: true,
    eventNodeBias: "random",
    spawnMinDistance: DEFAULT_SPAWN_MIN_DISTANCE,
    spawnMaxDistance: DEFAULT_SPAWN_MAX_DISTANCE,
    spawnMinSpacing: DEFAULT_SPAWN_MIN_SPACING,
    spawnPackChance: 0.42,
    spawnPackRadius: DEFAULT_SPAWN_PACK_RADIUS
  };
}

function buildPreparationFloorConfig(
  base: Pick<FloorConfig, "floorNumber" | "monsterHpMultiplier" | "monsterDmgMultiplier">,
  options: {
    pacingKind: Extract<NonNullable<FloorConfig["pacingKind"]>, "recovery" | "preparation">;
    layoutRoomCount: number;
    layoutCorridorLoopChance: number;
  }
): FloorConfig {
  return {
    ...base,
    monsterCount: 0,
    clearThreshold: 1,
    isBossFloor: false,
    pacingKind: options.pacingKind,
    grantsFloorClearRewards: false,
    eventNodeBias: "near_player",
    spawnMinDistance: DEFAULT_SPAWN_MIN_DISTANCE,
    spawnMaxDistance: DEFAULT_SPAWN_MAX_DISTANCE,
    spawnMinSpacing: DEFAULT_SPAWN_MIN_SPACING,
    spawnPackChance: 0,
    spawnPackRadius: DEFAULT_SPAWN_PACK_RADIUS,
    layoutRoomCount: options.layoutRoomCount,
    layoutCorridorHalfWidth: 1,
    layoutCorridorLoopChance: options.layoutCorridorLoopChance,
    layoutMaxExtraCorridors: 1
  };
}

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
      isBossFloor: true,
      pacingKind: "boss",
      grantsFloorClearRewards: false,
      eventNodeBias: "random",
      spawnMinDistance: DEFAULT_SPAWN_MIN_DISTANCE,
      spawnMaxDistance: DEFAULT_SPAWN_MAX_DISTANCE,
      spawnMinSpacing: DEFAULT_SPAWN_MIN_SPACING,
      spawnPackChance: 0,
      spawnPackRadius: DEFAULT_SPAWN_PACK_RADIUS,
      layoutRoomCount: 1,
      layoutCorridorHalfWidth: 1,
      layoutCorridorLoopChance: 0,
      layoutMaxExtraCorridors: 0
    };
  }

  if (normalized > resolvedStoryMaxFloor) {
    const endlessDelta = normalized - resolvedStoryMaxFloor;
    const endlessMultiplier = 1 + endlessDelta * 0.25;
    return buildCombatFloorConfig({
      floorNumber: normalized,
      monsterHpMultiplier: 2.5 * endlessMultiplier * hpDifficultyScale,
      monsterDmgMultiplier: 1.85 * endlessMultiplier * damageDifficultyScale,
      monsterCount: 16 + Math.min(10, endlessDelta * 2),
      clearThreshold: 0.72
    });
  }

  const lateFloorAdjustment =
    isLongRun
      ? likelyNightmare
        ? storyFloor <= 2
          ? {
              hpMultiplier: 0.82,
              damageMultiplier: 0.82
            }
          : storyFloor <= 4
            ? {
              hpMultiplier: 0.86,
              damageMultiplier: 0.86
            }
            : storyFloor <= 6
              ? {
                  hpMultiplier: 0.92,
                  damageMultiplier: 0.9
                }
              : {
                  hpMultiplier: 0.98,
                  damageMultiplier: 0.95
                }
        : storyFloor >= 5
          ? {
              hpMultiplier: storyFloor >= 7 ? 1.04 : 1,
              damageMultiplier: storyFloor >= 7 ? 1.34 : 1.22
            }
          : {
              hpMultiplier: 1,
              damageMultiplier: 1
            }
      : {
          hpMultiplier: 1,
          damageMultiplier: 1
        };
  const storyMonsterCountByFloor: Partial<Record<number, number>> | undefined = isLongRun
    ? {
        1: 14,
        2: 16,
        3: 18,
        4: 19,
        5: 0,
        6: 21,
        7: 0
      }
    : undefined;
  const monsterCountBase =
    storyMonsterCountByFloor?.[storyFloor] ?? (storyFloor <= 4 ? 12 + scaleIndex * 2 : 18 + Math.max(0, storyFloor - 5) * 2);
  const monsterHpMultiplier = (1 + scaleIndex * 0.18) * lateFloorAdjustment.hpMultiplier * hpDifficultyScale;
  const monsterDmgMultiplier = (1 + scaleIndex * 0.12) * lateFloorAdjustment.damageMultiplier * damageDifficultyScale;

  if (isLongRun && storyFloor === 5) {
    return buildPreparationFloorConfig(
      {
        floorNumber: storyFloor,
        monsterHpMultiplier,
        monsterDmgMultiplier
      },
      {
        pacingKind: "recovery",
        layoutRoomCount: 7,
        layoutCorridorLoopChance: 0.14
      }
    );
  }

  if (isLongRun && storyFloor === 7) {
    return buildPreparationFloorConfig(
      {
        floorNumber: storyFloor,
        monsterHpMultiplier,
        monsterDmgMultiplier
      },
      {
        pacingKind: "preparation",
        layoutRoomCount: 6,
        layoutCorridorLoopChance: 0.08
      }
    );
  }

  return buildCombatFloorConfig({
    floorNumber: storyFloor,
    monsterHpMultiplier,
    monsterDmgMultiplier,
    monsterCount: monsterCountBase,
    clearThreshold: 0.7
  });
}
