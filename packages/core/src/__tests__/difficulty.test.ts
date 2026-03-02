import { describe, expect, it } from "vitest";
import {
  createInitialDifficultyCompletions,
  DEFAULT_DIFFICULTY,
  getAvailableDifficulties,
  getDifficultyModifier,
  isDifficultyUnlocked,
  normalizeDifficultyCompletions,
  registerDifficultyVictory,
  resolveSelectedDifficulty,
  setSelectedDifficulty
} from "../difficulty";
import { createInitialMeta } from "../run";

describe("difficulty", () => {
  it("exposes static multipliers", () => {
    expect(getDifficultyModifier("normal")).toEqual({
      monsterHealthMultiplier: 1,
      monsterDamageMultiplier: 1,
      affixPolicy: "default",
      soulShardMultiplier: 1
    });
    expect(getDifficultyModifier("hard").monsterHealthMultiplier).toBe(1.3);
    expect(getDifficultyModifier("nightmare").affixPolicy).toBe("forceOne");
  });

  it("normalizes completion payloads from storage", () => {
    expect(normalizeDifficultyCompletions(undefined)).toEqual(createInitialDifficultyCompletions());
    expect(
      normalizeDifficultyCompletions({
        normal: 2,
        hard: -1,
        nightmare: 1.8
      })
    ).toEqual({
      normal: 2,
      hard: 0,
      nightmare: 1
    });
  });

  it("keeps all difficulties directly available", () => {
    const meta = createInitialMeta();
    expect(isDifficultyUnlocked(meta, "normal")).toBe(true);
    expect(isDifficultyUnlocked(meta, "hard")).toBe(true);
    expect(isDifficultyUnlocked(meta, "nightmare")).toBe(true);
    expect(getAvailableDifficulties(meta)).toEqual(["normal", "hard", "nightmare"]);

    const normalCleared = registerDifficultyVictory(meta, "normal");
    const hardCleared = registerDifficultyVictory(normalCleared, "hard");
    expect(getAvailableDifficulties(hardCleared)).toEqual(["normal", "hard", "nightmare"]);
  });

  it("allows selecting any difficulty directly", () => {
    const meta = createInitialMeta();
    expect(resolveSelectedDifficulty(meta)).toBe(DEFAULT_DIFFICULTY);

    const hardSelected = setSelectedDifficulty(meta, "hard");
    expect(hardSelected.selectedDifficulty).toBe("hard");

    const nightmareSelected = setSelectedDifficulty(meta, "nightmare");
    expect(nightmareSelected.selectedDifficulty).toBe("nightmare");
    expect(resolveSelectedDifficulty(nightmareSelected)).toBe("nightmare");
  });
});
