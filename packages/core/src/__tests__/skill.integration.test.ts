import { describe, expect, it } from "vitest";
import { SeededRng } from "../rng";
import { aggregateBuffEffects } from "../buff";
import { deriveStats } from "../stats";
import { resolveSkill } from "../skill";
import type { BuffDef, MonsterState, PlayerState, SkillDef } from "../contracts/types";

const skill: SkillDef = {
  id: "war_cry",
  name: "War Cry",
  description: "",
  icon: "",
  cooldownMs: 1000,
  manaCost: 10,
  damageType: "physical",
  targeting: "self",
  range: 0,
  effects: [{ type: "buff", value: 1, duration: 3000, buffId: "war_cry" }]
};

const defs: Record<string, BuffDef> = {
  war_cry: {
    id: "war_cry",
    name: "War Cry",
    duration: 3000,
    statModifiers: { attackPower: 6 }
  }
};

describe("skill integration", () => {
  it("applies buff and affects derived stats", () => {
    const player: PlayerState = {
      id: "p",
      position: { x: 0, y: 0 },
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      health: 100,
      mana: 40,
      baseStats: { strength: 8, dexterity: 8, vitality: 8, intelligence: 5 },
      derivedStats: deriveStats({ strength: 8, dexterity: 8, vitality: 8, intelligence: 5 }, []),
      inventory: [],
      equipment: {},
      gold: 0
    };

    const monsters: MonsterState[] = [];
    const resolution = resolveSkill(player, monsters, skill, new SeededRng("buff"), 1000);
    const effects = aggregateBuffEffects(resolution.buffsApplied, defs);
    const derived = deriveStats(player.baseStats, [], effects);

    expect(resolution.player.mana).toBe(30);
    expect(resolution.buffsApplied).toHaveLength(1);
    expect(effects.additive.attackPower).toBe(6);
    expect(derived.attackPower).toBeGreaterThanOrEqual(player.derivedStats.attackPower);
  });
});
