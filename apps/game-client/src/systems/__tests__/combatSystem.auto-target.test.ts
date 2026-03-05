import {
  SeededRng,
  createRunState,
  type BaseStats,
  type DerivedStats,
  type ItemInstance,
  type MonsterState,
  type PlayerState
} from "@blodex/core";
import { describe, expect, it } from "vitest";
import { CombatSystem } from "../CombatSystem";
import type { MonsterRuntime } from "../EntityManager";

function makePlayer(position: { x: number; y: number }): PlayerState {
  const baseStats: BaseStats = {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10
  };
  const derivedStats: DerivedStats = {
    maxHealth: 100,
    maxMana: 50,
    attackPower: 20,
    armor: 8,
    critChance: 0.1,
    attackSpeed: 1,
    moveSpeed: 130
  };
  return {
    id: "player",
    position,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    health: 100,
    mana: 50,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: [],
      cooldowns: {}
    },
    activeBuffs: []
  };
}

function makeMonsterState(id: string, position: { x: number; y: number }): MonsterState {
  return {
    id,
    archetypeId: "melee_grunt",
    level: 1,
    health: 100,
    maxHealth: 100,
    damage: 6,
    attackRange: 1.2,
    moveSpeed: 90,
    xpValue: 6,
    dropTableId: "none",
    position,
    aiState: "chase"
  };
}

function makeMonsterRuntime(id: string, position: { x: number; y: number }): MonsterRuntime {
  return {
    state: makeMonsterState(id, position),
    archetype: { id: "melee_grunt", name: "Grunt", aiConfig: { attackCooldownMs: 900 } } as MonsterRuntime["archetype"],
    sprite: { destroy: () => undefined } as unknown as MonsterRuntime["sprite"],
    healthBarBg: { destroy: () => undefined } as unknown as MonsterRuntime["healthBarBg"],
    healthBarFg: { destroy: () => undefined } as unknown as MonsterRuntime["healthBarFg"],
    affixMarker: undefined,
    healthBarYOffset: 0,
    yOffset: 0,
    nextAttackAt: 0,
    nextSupportAt: 0
  };
}

function makeLifestealWeapon(lifesteal = 0.1): ItemInstance {
  return {
    id: "weapon-lifesteal",
    defId: "weapon-lifesteal",
    name: "Lifesteal Weapon",
    slot: "weapon",
    rarity: "rare",
    requiredLevel: 1,
    iconId: "weapon",
    seed: "seed",
    rolledAffixes: {},
    rolledSpecialAffixes: {
      lifesteal
    }
  };
}

describe("CombatSystem auto target preference", () => {
  it("auto-targets nearest monster in range without forcing chase path", () => {
    const combat = new CombatSystem();
    const player = makePlayer({ x: 0, y: 0 });
    const nearMonster = makeMonsterRuntime("near", { x: 1, y: 0 });
    const farMonster = makeMonsterRuntime("far", { x: 5, y: 0 });
    const run = createRunState("seed", 0, "normal");
    const combatRng = new SeededRng("combat-seed");
    const lootRng = new SeededRng("loot-seed");

    const result = combat.updatePlayerAttack({
      player,
      run,
      monsters: [farMonster, nearMonster],
      attackTargetId: null,
      nextPlayerAttackAt: 0,
      nowMs: 0,
      combatRng,
      lootRng,
      itemDefs: {},
      lootTables: {}
    });

    expect(result.attackTargetId).toBe("near");
    expect(result.requestPathTarget).toBeUndefined();
  });

  it("keeps clicked target priority even when another monster is closer", () => {
    const combat = new CombatSystem();
    const player = makePlayer({ x: 0, y: 0 });
    const nearMonster = makeMonsterRuntime("near", { x: 2, y: 0 });
    const clickedMonster = makeMonsterRuntime("clicked", { x: 4, y: 0 });
    const run = createRunState("seed", 0, "normal");
    const combatRng = new SeededRng("combat-seed");
    const lootRng = new SeededRng("loot-seed");

    const result = combat.updatePlayerAttack({
      player,
      run,
      monsters: [nearMonster, clickedMonster],
      attackTargetId: "clicked",
      nextPlayerAttackAt: 0,
      nowMs: 0,
      combatRng,
      lootRng,
      itemDefs: {},
      lootTables: {}
    });

    expect(result.attackTargetId).toBe("clicked");
    expect(result.requestPathTarget).toEqual({ x: 4, y: 0 });
  });

  it("does not auto-target monsters outside assist range", () => {
    const combat = new CombatSystem();
    const player = makePlayer({ x: 0, y: 0 });
    const farMonster = makeMonsterRuntime("far", { x: 3, y: 0 });
    const run = createRunState("seed", 0, "normal");
    const combatRng = new SeededRng("combat-seed");
    const lootRng = new SeededRng("loot-seed");

    const result = combat.updatePlayerAttack({
      player,
      run,
      monsters: [farMonster],
      attackTargetId: null,
      nextPlayerAttackAt: 0,
      nowMs: 0,
      combatRng,
      lootRng,
      itemDefs: {},
      lootTables: {}
    });

    expect(result.attackTargetId).toBeNull();
    expect(result.requestPathTarget).toBeUndefined();
    expect(result.combatEvents).toEqual([]);
  });

  it("preserves lifesteal health on non-kill player attacks", () => {
    const combat = new CombatSystem();
    const player = {
      ...makePlayer({ x: 0, y: 0 }),
      health: 40,
      equipment: {
        weapon: makeLifestealWeapon(0.1)
      }
    };
    const target = makeMonsterRuntime("target", { x: 1, y: 0 });
    const run = createRunState("seed", 0, "normal");

    const result = combat.updatePlayerAttack({
      player,
      run,
      monsters: [target],
      attackTargetId: "target",
      nextPlayerAttackAt: 0,
      nowMs: 0,
      combatRng: new SeededRng("combat-seed"),
      lootRng: new SeededRng("loot-seed"),
      itemDefs: {},
      lootTables: {}
    });

    expect(result.player.health).toBeGreaterThan(player.health);
    expect(result.killedMonsterId).toBeUndefined();
  });

  it("keeps lifesteal contribution when kill recovery is applied", () => {
    const combat = new CombatSystem();
    const player = {
      ...makePlayer({ x: 0, y: 0 }),
      health: 40,
      equipment: {
        weapon: makeLifestealWeapon(0.1)
      }
    };
    const target = makeMonsterRuntime("target", { x: 1, y: 0 });
    target.state.health = 10;
    target.state.maxHealth = 10;
    const run = createRunState("seed", 0, "normal");

    const result = combat.updatePlayerAttack({
      player,
      run,
      monsters: [target],
      attackTargetId: "target",
      nextPlayerAttackAt: 0,
      nowMs: 0,
      combatRng: new SeededRng("combat-seed"),
      lootRng: new SeededRng("loot-seed"),
      itemDefs: {},
      lootTables: {}
    });

    expect(result.killedMonsterId).toBe("target");
    expect(result.player.health).toBeGreaterThan(player.health + 12);
  });
});
