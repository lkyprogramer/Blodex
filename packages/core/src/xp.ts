import type { BaseStats, PlayerState } from "./contracts/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface XpGainOptions {
  xpBonus?: number;
}

export interface XpGainResult {
  player: PlayerState;
  leveledUp: boolean;
  levelsGained: number;
  pendingLevelUpChoices: number;
  pendingSkillChoices: number;
}

export function applyLevelUpChoice(player: PlayerState, stat: keyof BaseStats): PlayerState {
  const available = Math.max(0, Math.floor(player.pendingLevelUpChoices ?? 0));
  if (available <= 0) {
    return player;
  }

  return {
    ...player,
    baseStats: {
      ...player.baseStats,
      [stat]: player.baseStats[stat] + 1
    },
    pendingLevelUpChoices: available - 1
  };
}

export function xpForNextLevel(level: number): number {
  return Math.floor(80 + level * level * 18);
}

export function applyXpGain(
  player: PlayerState,
  amount: number,
  statPreference: keyof BaseStats | "manual" = "strength",
  options?: XpGainOptions
): XpGainResult {
  const xpBonus = clamp(options?.xpBonus ?? 0, 0, 5);
  const normalizedAmount = Math.max(0, Math.floor(amount * (1 + xpBonus)));
  let xp = player.xp + normalizedAmount;
  let level = player.level;
  let xpToNext = player.xpToNextLevel;
  const base = { ...player.baseStats };
  let pendingLevelUpChoices = Math.max(0, Math.floor(player.pendingLevelUpChoices ?? 0));
  let pendingSkillChoices = Math.max(0, Math.floor(player.pendingSkillChoices ?? 0));
  let leveledUp = false;
  let levelsGained = 0;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = xpForNextLevel(level);
    if (statPreference === "manual") {
      pendingLevelUpChoices += 1;
      pendingSkillChoices += 1;
    } else {
      base[statPreference] += 1;
    }
    leveledUp = true;
    levelsGained += 1;
  }

  return {
    player: {
      ...player,
      level,
      xp,
      xpToNextLevel: xpToNext,
      baseStats: base,
      pendingLevelUpChoices,
      pendingSkillChoices
    },
    leveledUp,
    levelsGained,
    pendingLevelUpChoices,
    pendingSkillChoices
  };
}
