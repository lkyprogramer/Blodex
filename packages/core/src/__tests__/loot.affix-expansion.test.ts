import { describe, expect, it } from "vitest";
import { rollItemDrop } from "../loot";
import { SeededRng } from "../rng";
import type { ItemDef, LootTableDef } from "../contracts/types";

const itemDefs: Record<string, ItemDef> = {
  normal_blade: {
    id: "normal_blade",
    name: "Normal Blade",
    slot: "weapon",
    rarity: "magic",
    requiredLevel: 1,
    iconId: "icon_weapon",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "attackPower", min: 2, max: 5 },
      { key: "critChance", min: 1, max: 2 }
    ],
    minSpecialAffixes: 1,
    maxSpecialAffixes: 1,
    specialAffixPool: [{ key: "lifesteal", min: 2, max: 5 }]
  },
  unique_blade: {
    id: "unique_blade",
    name: "Unique Blade",
    kind: "unique",
    slot: "weapon",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "icon_weapon",
    minAffixes: 0,
    maxAffixes: 0,
    affixPool: [],
    fixedAffixes: {
      attackPower: 20,
      critChance: 4
    },
    fixedSpecialAffixes: {
      critDamage: 20
    }
  }
};

const lootTable: LootTableDef = {
  id: "test",
  entries: [
    { itemDefId: "normal_blade", weight: 60, minFloor: 1 },
    { itemDefId: "unique_blade", weight: 40, minFloor: 1 }
  ]
};

describe("loot affix expansion", () => {
  it("keeps normal equipment random but deterministic by seed", () => {
    const rngA = new SeededRng("loot-special-a");
    const rngB = new SeededRng("loot-special-a");
    const first = rollItemDrop(lootTable, itemDefs, 2, rngA, "a");
    const second = rollItemDrop(lootTable, itemDefs, 2, rngB, "a");
    expect(first).toEqual(second);
  });

  it("keeps unique affixes fixed and independent from random pools", () => {
    const rng = new SeededRng("loot-special-b");
    const uniqueOnly: LootTableDef = {
      id: "unique-only",
      entries: [{ itemDefId: "unique_blade", weight: 1, minFloor: 1 }]
    };
    const item = rollItemDrop(uniqueOnly, itemDefs, 5, rng, "x");
    expect(item?.kind).toBe("unique");
    expect(item?.rolledAffixes.attackPower).toBe(20);
    expect(item?.rolledSpecialAffixes?.critDamage).toBe(20);
  });
});

