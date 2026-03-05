import { describe, expect, it } from "vitest";
import type { MonsterState, PlayerState, SkillDef } from "../contracts/types";
import { resolveMonsterAttack, resolvePlayerAttack } from "../combat";
import { applySoulShardBonus, resolveHealthRegenTick } from "../specialAffix";
import { markSkillUsed, resolveSkill } from "../skill";
import { applyXpGain } from "../xp";

function fixedRng(value: number) {
  return {
    next: () => value,
    nextInt: (min: number) => min,
    pick: <T>(items: T[]) => items[0] as T
  };
}

function makePlayer(): PlayerState {
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    health: 100,
    mana: 60,
    gold: 0,
    baseStats: { strength: 10, dexterity: 10, vitality: 10, intelligence: 6 },
    derivedStats: {
      maxHealth: 100,
      maxMana: 60,
      armor: 0,
      attackPower: 20,
      critChance: 1,
      attackSpeed: 1,
      moveSpeed: 140
    },
    inventory: [],
    equipment: {}
  };
}

function makeMonster(health = 80): MonsterState {
  return {
    id: "monster",
    archetypeId: "melee_grunt",
    level: 1,
    health,
    maxHealth: health,
    damage: 20,
    attackRange: 1,
    moveSpeed: 100,
    xpValue: 12,
    dropTableId: "starter",
    position: { x: 1, y: 0 },
    aiState: "attack"
  };
}

describe("combat contract", () => {
  it("consumes lifesteal and critDamage on player attack", () => {
    const player = {
      ...makePlayer(),
      health: 50
    };
    const monster = makeMonster(100);
    const result = resolvePlayerAttack(player, monster, fixedRng(0), 1000, {
      specialAffixTotals: {
        lifesteal: 0.1,
        critDamage: 0.5
      }
    });

    expect(result.monster.health).toBeLessThan(monster.health);
    expect(result.player.health).toBeGreaterThan(player.health);
    expect(result.events.some((event) => event.kind === "crit")).toBe(true);
  });

  it("consumes dodgeChance and thorns on incoming monster attacks", () => {
    const dodged = resolveMonsterAttack(makeMonster(50), makePlayer(), fixedRng(0), 1000, {
      dodgeChance: 0.2
    });
    expect(dodged.player.health).toBe(100);
    expect(dodged.events[0]?.kind).toBe("dodge");

    const reflected = resolveMonsterAttack(makeMonster(50), makePlayer(), fixedRng(0.9), 2000, {
      thorns: 0.5
    });
    expect(reflected.player.health).toBeLessThan(100);
    const thornsEvent = reflected.events.find((event) => event.sourceId === "player" && event.targetId === "monster");
    expect(thornsEvent?.kind).toBe("damage");
    expect(reflected.monster.health).toBeLessThan(50);
  });

  it("consumes aoeRadius, damageOverTime and lifesteal on skill resolution", () => {
    const player = {
      ...makePlayer(),
      health: 70
    };
    const monsters: MonsterState[] = [
      {
        ...makeMonster(40),
        id: "near",
        position: { x: 2.8, y: 0 }
      }
    ];
    const skill: SkillDef = {
      id: "dot_blast",
      name: "Dot Blast",
      description: "",
      icon: "",
      cooldownMs: 1000,
      manaCost: 5,
      damageType: "arcane",
      targeting: "nearest",
      range: 2,
      effects: [{ type: "damage", value: 10 }]
    };

    const resolution = resolveSkill(player, monsters, skill, fixedRng(1), 3000, {
      specialAffixTotals: {
        aoeRadius: 0.5,
        damageOverTime: 5,
        lifesteal: 0.2
      }
    });

    expect(resolution.events).toHaveLength(1);
    expect(resolution.affectedMonsters[0]?.health).toBe(25);
    expect(resolution.player.health).toBeGreaterThan(player.health);
  });

  it("consumes cooldownReduction when applying skill cooldown", () => {
    const state = {
      skillSlots: [],
      cooldowns: {}
    };
    const skill: SkillDef = {
      id: "cooldown_probe",
      name: "Cooldown Probe",
      description: "",
      icon: "",
      cooldownMs: 1000,
      manaCost: 0,
      damageType: "physical",
      targeting: "self",
      range: 0,
      effects: [{ type: "heal", value: 1 }]
    };
    const used = markSkillUsed(state, skill, 500, {
      cooldownReduction: 0.8
    });
    expect(used.cooldowns.cooldown_probe).toBe(800);
  });

  it("consumes xpBonus on XP gain settlement", () => {
    const result = applyXpGain(makePlayer(), 50, "strength", {
      xpBonus: 0.5
    });
    expect(result.player.xp).toBe(75);
    expect(result.leveledUp).toBe(false);
  });

  it("consumes healthRegen and soulShardBonus settlement helpers", () => {
    const tick = resolveHealthRegenTick(50, 100, 6, 500, 0);
    expect(tick.health).toBe(53);
    expect(tick.healed).toBe(3);

    expect(applySoulShardBonus(20, 0.25)).toBe(25);
  });
});
