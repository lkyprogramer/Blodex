import { describe, expect, it } from "vitest";
import type { PlayerState } from "../contracts/types";
import { applyLevelUpChoice, applyXpGain } from "../xp";

function makePlayer(): PlayerState {
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    pendingLevelUpChoices: 0,
    pendingSkillChoices: 0,
    health: 120,
    mana: 50,
    baseStats: { strength: 10, dexterity: 9, vitality: 11, intelligence: 7 },
    derivedStats: {
      maxHealth: 120,
      maxMana: 50,
      armor: 12,
      attackPower: 28,
      critChance: 0.05,
      attackSpeed: 1,
      moveSpeed: 142
    },
    inventory: [],
    equipment: {},
    gold: 0
  };
}

describe("xp settlement", () => {
  it("accumulates pending level-up choices in manual mode", () => {
    const result = applyXpGain(makePlayer(), 280, "manual");

    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBe(2);
    expect(result.pendingLevelUpChoices).toBe(2);
    expect(result.pendingSkillChoices).toBe(2);
    expect(result.player.baseStats.strength).toBe(10);
  });

  it("still supports direct stat allocation mode", () => {
    const result = applyXpGain(makePlayer(), 120, "dexterity");

    expect(result.levelsGained).toBe(1);
    expect(result.player.baseStats.dexterity).toBe(10);
    expect(result.pendingLevelUpChoices).toBe(0);
    expect(result.pendingSkillChoices).toBe(0);
  });

  it("consumes one pending point when applying a level-up choice", () => {
    const leveled = applyXpGain(makePlayer(), 120, "manual").player;
    const picked = applyLevelUpChoice(leveled, "vitality");

    expect(picked.baseStats.vitality).toBe(12);
    expect(picked.pendingLevelUpChoices).toBe(0);
    expect(picked.pendingSkillChoices).toBe(1);
  });
});
