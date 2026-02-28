import type { DifficultyMode, GameConfig } from "./types";

export const GAME_CONFIG: GameConfig = {
  tileWidth: 96,
  tileHeight: 48,
  gridWidth: 64,
  gridHeight: 64,
  floorClearKillTarget: 12,
  floorClearKillRatio: 0.7,
  maxFloors: 5,
  enemyBaseHealth: 85,
  enemyBaseDamage: 7
};

export const DIFFICULTY_CONFIG: Record<
  DifficultyMode,
  {
    monsterHealthMultiplier: number;
    monsterDamageMultiplier: number;
    affixPolicy: "default" | "forceOne";
    soulShardMultiplier: number;
  }
> = {
  normal: {
    monsterHealthMultiplier: 1,
    monsterDamageMultiplier: 1,
    affixPolicy: "default",
    soulShardMultiplier: 1
  },
  hard: {
    monsterHealthMultiplier: 1.3,
    monsterDamageMultiplier: 1.3,
    affixPolicy: "default",
    soulShardMultiplier: 1.5
  },
  nightmare: {
    monsterHealthMultiplier: 1.6,
    monsterDamageMultiplier: 1.6,
    affixPolicy: "forceOne",
    soulShardMultiplier: 2
  }
};
