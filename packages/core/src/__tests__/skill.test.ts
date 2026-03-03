import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import {
  canUseSkill,
  createSkillDefForLevel,
  markSkillUsed,
  pickSkillChoices,
  pickSkillChoicesWeighted,
  resolveSkill
} from "../skill";
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

function makePlayer(): PlayerState {
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    health: 120,
    mana: 40,
    gold: 0,
    baseStats: { strength: 10, dexterity: 10, vitality: 10, intelligence: 6 },
    derivedStats: {
      maxHealth: 120,
      maxMana: 40,
      armor: 12,
      attackPower: 25,
      critChance: 0,
      attackSpeed: 1,
      moveSpeed: 140
    },
    inventory: [],
    equipment: {}
  };
}

function makeMonster(id: string, x: number): MonsterState {
  return {
    id,
    archetypeId: "melee_grunt",
    level: 1,
    health: 80,
    maxHealth: 80,
    damage: 15,
    attackRange: 1,
    moveSpeed: 110,
    xpValue: 20,
    dropTableId: "starter",
    position: { x, y: 0 },
    aiState: "attack"
  };
}

function makeSkill(range: number): SkillDef {
  return {
    id: "blood_drain",
    name: "Blood Drain",
    description: "Drain life from nearest enemy",
    icon: "blood_drain",
    cooldownMs: 1000,
    manaCost: 10,
    damageType: "arcane",
    targeting: "nearest",
    range,
    effects: [{ type: "damage", value: 20 }]
  };
}

const neverCritRng = {
  next: () => 1,
  nextInt: () => 0,
  pick: <T>(items: T[]): T => items[0] as T
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

  it("scales effect/cooldown by skill level", () => {
    const level2 = createSkillDefForLevel(CLEAVE, 2);
    const level3 = createSkillDefForLevel(CLEAVE, 3);
    expect(level2.cooldownMs).toBe(2700);
    expect(level3.cooldownMs).toBe(2400);
    const effect2 = level2.effects[0];
    const effect3 = level3.effects[0];
    if (effect2 === undefined || effect3 === undefined) {
      return;
    }
    const value2 = effect2.value;
    const value3 = effect3.value;
    if (typeof value2 === "number" || typeof value3 === "number") {
      return;
    }
    expect(value2.ratio).toBeCloseTo(1.56);
    expect(value3.ratio).toBeCloseTo(1.92);
  });

  it("weights skill offers by strongest stat and owned skills", () => {
    const rng = new SeededRng("weighted");
    const pool: SkillDef[] = [
      { ...CLEAVE, id: "warrior_a", archetype: "warrior" },
      { ...CLEAVE, id: "warrior_b", archetype: "warrior" },
      { ...CLEAVE, id: "ranger_a", archetype: "ranger" },
      { ...CLEAVE, id: "arcane_a", archetype: "arcanist" }
    ];
    const picked = pickSkillChoicesWeighted(
      pool,
      rng,
      {
        strongestStat: "strength",
        ownedSkillIds: ["warrior_a"]
      },
      3
    );
    expect(picked).toHaveLength(3);
    expect(picked.map((entry) => entry.id)).toContain("warrior_b");
  });
});

describe("skill targeting", () => {
  it("does not target nearest monster when all living monsters are out of range", () => {
    const player = makePlayer();
    const farMonster = makeMonster("far", 10);

    const result = resolveSkill(player, [farMonster], makeSkill(5), neverCritRng, 1000);

    expect(result.events).toHaveLength(0);
    expect(result.affectedMonsters[0]?.health).toBe(farMonster.health);
  });

  it("targets the nearest monster within range", () => {
    const player = makePlayer();
    const inRangeMonster = makeMonster("near", 4);
    const outOfRangeMonster = makeMonster("far", 8);

    const result = resolveSkill(player, [outOfRangeMonster, inRangeMonster], makeSkill(5), neverCritRng, 1000);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.targetId).toBe("near");
    expect(result.affectedMonsters.find((monster) => monster.id === "near")?.health).toBe(60);
    expect(result.affectedMonsters.find((monster) => monster.id === "far")?.health).toBe(80);
  });
});
