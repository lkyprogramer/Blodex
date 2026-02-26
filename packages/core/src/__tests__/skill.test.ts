import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import { canUseSkill, markSkillUsed, pickSkillChoices, resolveSkill } from "../skill";
import type { MonsterState, PlayerState, SkillDef } from "../contracts/types";

const PLAYER: PlayerState = {
  id: "p",
  position: { x: 0, y: 0 },
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  health: 100,
  mana: 100,
  baseStats: { strength: 10, dexterity: 8, vitality: 8, intelligence: 6 },
  derivedStats: {
    maxHealth: 100,
    maxMana: 100,
    armor: 5,
    attackPower: 20,
    critChance: 0.1,
    attackSpeed: 1,
    moveSpeed: 140
  },
  inventory: [],
  equipment: {},
  gold: 0,
  skills: {
    skillSlots: [{ defId: "cleave", level: 1 }, null, null, null],
    cooldowns: {}
  }
};

const MONSTER: MonsterState = {
  id: "m1",
  archetypeId: "melee_grunt",
  level: 1,
  health: 30,
  maxHealth: 30,
  damage: 8,
  attackRange: 1,
  moveSpeed: 100,
  xpValue: 10,
  dropTableId: "starter_floor",
  position: { x: 1, y: 0 },
  aiState: "attack"
};

const CLEAVE: SkillDef = {
  id: "cleave",
  name: "Cleave",
  description: "",
  icon: "",
  cooldownMs: 3000,
  manaCost: 8,
  damageType: "physical",
  targeting: "aoe_around",
  range: 2,
  effects: [{ type: "damage", value: { base: 0, scaling: "strength", ratio: 1.2 } }]
};

describe("skill", () => {
  it("checks cooldown and mana", () => {
    const state = PLAYER.skills!;
    expect(canUseSkill(PLAYER, state, CLEAVE, 0)).toBe(true);
    const used = markSkillUsed(state, CLEAVE, 100);
    expect(canUseSkill(PLAYER, used, CLEAVE, 200)).toBe(false);
  });

  it("resolves damage skill", () => {
    const rng = new SeededRng("skill");
    const result = resolveSkill(PLAYER, [MONSTER], CLEAVE, rng, 1000);
    expect(result.player.mana).toBe(92);
    expect(result.affectedMonsters[0]!.health).toBeLessThan(MONSTER.health);
  });

  it("picks deterministic skill choices", () => {
    const rng = new SeededRng("choices");
    const pool = [
      { ...CLEAVE, id: "a" },
      { ...CLEAVE, id: "b" },
      { ...CLEAVE, id: "c" },
      { ...CLEAVE, id: "d" }
    ];
    const first = pickSkillChoices(pool, rng, 3).map((entry) => entry.id);
    const second = pickSkillChoices(pool, new SeededRng("choices"), 3).map((entry) => entry.id);
    expect(first).toEqual(second);
  });
});
