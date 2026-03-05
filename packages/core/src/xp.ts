import type { BaseStats, PlayerState } from "./contracts/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface XpGainOptions {
  xpBonus?: number;
}

export function xpForNextLevel(level: number): number {
  return Math.floor(80 + level * level * 18);
}

export function applyXpGain(
  player: PlayerState,
  amount: number,
  statPreference: keyof BaseStats = "strength",
  options?: XpGainOptions
): { player: PlayerState; leveledUp: boolean } {
  const xpBonus = clamp(options?.xpBonus ?? 0, 0, 5);
  const normalizedAmount = Math.max(0, Math.floor(amount * (1 + xpBonus)));
  let xp = player.xp + normalizedAmount;
  let level = player.level;
  let xpToNext = player.xpToNextLevel;
  const base = { ...player.baseStats };
  let leveledUp = false;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = xpForNextLevel(level);
    base[statPreference] += 1;
    leveledUp = true;
  }

  return {
    player: {
      ...player,
      level,
      xp,
      xpToNextLevel: xpToNext,
      baseStats: base
    },
    leveledUp
  };
}
