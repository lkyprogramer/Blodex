import type { DifficultyMode } from "./contracts/types";

export type SimulatedPlayerBehavior = "optimal" | "average" | "poor";

export function estimateStoryFloorPacingOverheadMs(options: {
  floor: number;
  difficulty: DifficultyMode;
  playerBehavior: SimulatedPlayerBehavior;
  isBossFloor?: boolean;
}): number {
  const floor = Math.max(1, Math.floor(options.floor));
  const isBossFloor = options.isBossFloor === true;
  const difficultyMs =
    options.difficulty === "normal" ? 0 : options.difficulty === "hard" ? 12_000 : 20_000;
  const behaviorMs =
    options.playerBehavior === "optimal" ? -10_000 : options.playerBehavior === "poor" ? 15_000 : 0;

  if (isBossFloor) {
    return Math.max(45_000, 180_000 + difficultyMs + behaviorMs);
  }

  const explorationMs = 70_000 + floor * 18_000;
  const choiceMs = 18_000 + floor * 4_000;
  const economyMs = floor === 2 ? 20_000 : floor === 3 ? 25_000 : floor >= 4 ? 30_000 : 10_000;
  return Math.max(30_000, explorationMs + choiceMs + economyMs + difficultyMs + behaviorMs);
}
