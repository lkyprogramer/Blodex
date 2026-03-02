import type { ItemInstance } from "@blodex/core";
import { describe, expect, it } from "vitest";
import { EntityManager, type LootRuntime } from "../EntityManager";

function makeItem(id: string): ItemInstance {
  return {
    id,
    defId: "test_item",
    name: `Item-${id}`,
    slot: "ring",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_ring_01",
    seed: id,
    rolledAffixes: {}
  };
}

function makeLoot(id: string, position: { x: number; y: number }): LootRuntime {
  return {
    item: makeItem(id),
    sprite: { destroy: () => undefined } as unknown as LootRuntime["sprite"],
    position
  };
}

describe("EntityManager.consumeLootNear", () => {
  it("picks edge drops with expanded radius but keeps out-of-range drops", () => {
    const manager = new EntityManager();
    manager.addLoot(makeLoot("edge", { x: 1.1, y: 0 }));
    manager.addLoot(makeLoot("far", { x: 1.35, y: 0 }));

    const picked = manager.consumeLootNear({ x: 0, y: 0 }, 1.15);

    expect(picked.map((drop) => drop.item.id)).toEqual(["edge"]);
    expect(manager.listLoot().map((drop) => drop.item.id)).toEqual(["far"]);
  });
});
