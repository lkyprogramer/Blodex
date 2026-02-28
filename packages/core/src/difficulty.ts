import type { DifficultyMode, DifficultyModifier, MetaProgression } from "./contracts/types";

export const DIFFICULTY_MODIFIERS: Record<DifficultyMode, DifficultyModifier> = {
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

export const DEFAULT_DIFFICULTY: DifficultyMode = "normal";

export function normalizeDifficultyMode(
  input: unknown,
  fallback: DifficultyMode = DEFAULT_DIFFICULTY
): DifficultyMode {
  if (input === "normal" || input === "hard" || input === "nightmare") {
    return input;
  }
  return fallback;
}

export function createInitialDifficultyCompletions(): Record<DifficultyMode, number> {
  return {
    normal: 0,
    hard: 0,
    nightmare: 0
  };
}

export function normalizeDifficultyCompletions(input: unknown): Record<DifficultyMode, number> {
  if (typeof input !== "object" || input === null) {
    return createInitialDifficultyCompletions();
  }
  const record = input as Record<string, unknown>;
  const asCount = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return {
    normal: asCount(record.normal),
    hard: asCount(record.hard),
    nightmare: asCount(record.nightmare)
  };
}

export function getDifficultyModifier(mode: DifficultyMode): DifficultyModifier {
  return DIFFICULTY_MODIFIERS[mode];
}

export function isDifficultyUnlocked(
  meta: Pick<MetaProgression, "difficultyCompletions">,
  mode: DifficultyMode
): boolean {
  void meta;
  void mode;
  // Current design goal: difficulty should be directly selectable for faster iteration.
  return true;
}

export function getAvailableDifficulties(
  meta: Pick<MetaProgression, "difficultyCompletions">
): DifficultyMode[] {
  return (["normal", "hard", "nightmare"] as const).filter((mode) =>
    isDifficultyUnlocked(meta, mode)
  );
}

export function resolveSelectedDifficulty(
  meta: Pick<MetaProgression, "selectedDifficulty" | "difficultyCompletions">
): DifficultyMode {
  if (isDifficultyUnlocked(meta, meta.selectedDifficulty)) {
    return meta.selectedDifficulty;
  }
  const available = getAvailableDifficulties(meta);
  return available[available.length - 1] ?? DEFAULT_DIFFICULTY;
}

export function setSelectedDifficulty(meta: MetaProgression, mode: DifficultyMode): MetaProgression {
  if (!isDifficultyUnlocked(meta, mode) || mode === meta.selectedDifficulty) {
    return meta;
  }
  return {
    ...meta,
    selectedDifficulty: mode
  };
}

export function registerDifficultyVictory(meta: MetaProgression, mode: DifficultyMode): MetaProgression {
  return {
    ...meta,
    difficultyCompletions: {
      ...meta.difficultyCompletions,
      [mode]: (meta.difficultyCompletions[mode] ?? 0) + 1
    }
  };
}
