import { describe, expect, it } from "vitest";
import { resolvePlayerAttack } from "../combat";
import { collectLoot } from "../run";
import { rollItemDrop } from "../loot";
import { equipItem } from "../inventory";
import { deriveStats } from "../stats";
import { SeededRng } from "../rng";
import type { ItemDef, LootTableDef, MonsterState, PlayerState } from "../contracts/types";

function makePlayer(): PlayerState {
  const baseStats = { strength: 12, dexterity: 10, vitality: 10, intelligence: 6 };
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 2,
    xp: 0,
    xpToNextLevel: 120,
    health: 280,
    mana: 100,
    baseStats,
    derivedStats: deriveStats(baseStats, []),
    inventory: [],
    equipment: {},
    gold: 0
  };
}

function makeMonster(): MonsterState {
  return {
    id: "monster-1",
    archetypeId: "melee_grunt",
    level: 1,
    health: 22,
    maxHealth: 22,
    damage: 8,
    attackRange: 1,
    moveSpeed: 110,
    xpValue: 15,
    dropTableId: "starter_floor",
    position: { x: 1, y: 0 },
    aiState: "attack"
  };
}

describe("integration flow", () => {
  it("supports kill -> drop -> pickup -> equip chain", () => {
    const combatRng = new SeededRng("combat-flow");
    const lootRng = new SeededRng("loot-flow");
    const player = makePlayer();
    const monster = makeMonster();

    const kill = resolvePlayerAttack(player, monster, combatRng, 1_000);
    expect(kill.monster.health).toBe(0);

    const itemDefs: Record<string, ItemDef> = {
      blade: {
        id: "blade",
        name: "Initiate Blade",
        slot: "weapon",
        rarity: "magic",
        requiredLevel: 1,
        iconId: "icon_blade",
        minAffixes: 1,
        maxAffixes: 1,
        affixPool: [{ key: "attackPower", min: 4, max: 4 }]
      }
    };
    const lootTable: LootTableDef = {
      id: "starter_floor",
      entries: [{ itemDefId: "blade", weight: 1, minFloor: 1 }]
    };

    const item = rollItemDrop(lootTable, itemDefs, 1, lootRng, "drop-1");
    expect(item).not.toBeNull();
    if (item === null) {
      return;
    }

    const pickedUp = collectLoot(kill.player, item);
    expect(pickedUp.inventory).toHaveLength(1);

    const equipped = equipItem(pickedUp, item.id);
    expect(equipped.inventory).toHaveLength(0);
    expect(equipped.equipment.weapon?.id).toBe(item.id);
    expect(equipped.derivedStats.attackPower).toBeGreaterThan(pickedUp.derivedStats.attackPower);
  });
});
