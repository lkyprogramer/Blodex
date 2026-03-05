import { describe, expect, it } from "vitest";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP } from "../index";
import type { ItemRarity } from "../types";

function raritiesAtFloor(tableId: string, floor: number): Set<ItemRarity> {
  const table = LOOT_TABLE_MAP[tableId];
  if (table === undefined) {
    return new Set<ItemRarity>();
  }
  return new Set(
    table.entries
      .filter((entry) => entry.minFloor <= floor)
      .map((entry) => ITEM_DEF_MAP[entry.itemDefId]?.rarity)
      .filter((rarity): rarity is ItemRarity => rarity !== undefined)
  );
}

function hasUniqueAtFloor(tableId: string, floor: number): boolean {
  const table = LOOT_TABLE_MAP[tableId];
  if (table === undefined) {
    return false;
  }
  return table.entries.some((entry) => entry.minFloor <= floor && ITEM_DEF_MAP[entry.itemDefId]?.kind === "unique");
}

describe("loot floor bands", () => {
  it("keeps floor-1 pool as common/magic only", () => {
    const starter = raritiesAtFloor("starter_floor", 1);
    expect(starter.has("common")).toBe(true);
    expect(starter.has("rare")).toBe(false);
  });

  it("delays cathedral rare pool until floor 4", () => {
    const early = raritiesAtFloor("cathedral_depths", 2);
    const late = raritiesAtFloor("cathedral_depths", 4);

    expect(early.has("rare")).toBe(false);
    expect(late.has("rare")).toBe(true);
  });

  it("keeps merchant unique pool gated to floor 5", () => {
    expect(hasUniqueAtFloor("merchant_pool", 4)).toBe(false);
    expect(hasUniqueAtFloor("merchant_pool", 5)).toBe(true);
  });
});
