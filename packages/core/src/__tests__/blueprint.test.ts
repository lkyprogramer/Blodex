import { describe, expect, it } from "vitest";
import type { BlueprintDef, RngLike } from "../contracts/types";
import { createInitialMeta } from "../run";
import {
  canForgeBlueprint,
  forgeBlueprint,
  mergeFoundBlueprints,
  rollBlueprintDiscoveries
} from "../blueprint";

function makeRng(values: number[]): RngLike {
  let index = 0;
  return {
    next(): number {
      const value = values[index] ?? values[values.length - 1] ?? 0;
      index += 1;
      return value;
    },
    nextInt(min: number, max: number): number {
      if (min >= max) {
        return min;
      }
      const span = max - min + 1;
      return min + Math.floor(this.next() * span) % span;
    },
    pick<T>(items: T[]): T {
      return items[this.nextInt(0, Math.max(0, items.length - 1))] as T;
    }
  };
}

const BLUEPRINTS: BlueprintDef[] = [
  {
    id: "bp_sword_rare",
    name: "Sword Schema",
    category: "weapon",
    unlockTargetId: "weapon_type_sword",
    forgeCost: 20,
    rarity: "rare",
    dropSources: [
      {
        type: "floor_clear",
        chance: 0.5,
        floorMin: 1
      }
    ]
  },
  {
    id: "bp_shrine_event",
    name: "Shrine Sigil",
    category: "event",
    unlockTargetId: "event_shrine_plus",
    forgeCost: 12,
    rarity: "common",
    dropSources: [
      {
        type: "random_event",
        sourceId: "mysterious_shrine",
        chance: 1,
        onlyIfNotFound: true
      }
    ]
  }
];

describe("blueprint", () => {
  it("merges found blueprints idempotently", () => {
    const base = {
      ...createInitialMeta(),
      blueprintFoundIds: ["bp_sword_rare"]
    };
    const next = mergeFoundBlueprints(base, ["bp_sword_rare", "bp_shrine_event"]);
    expect(next.blueprintFoundIds).toEqual(["bp_sword_rare", "bp_shrine_event"]);

    const nextAgain = mergeFoundBlueprints(next, ["bp_shrine_event"]);
    expect(nextAgain).toEqual(next);
  });

  it("rolls drop by source and chance", () => {
    const discovered = rollBlueprintDiscoveries(
      BLUEPRINTS,
      { sourceType: "floor_clear", floor: 1 },
      makeRng([0.49, 0.8]),
      []
    );
    expect(discovered).toEqual(["bp_sword_rare"]);

    const shrineDiscovered = rollBlueprintDiscoveries(
      BLUEPRINTS,
      { sourceType: "random_event", sourceId: "mysterious_shrine", floor: 2 },
      makeRng([0.2]),
      ["bp_sword_rare"]
    );
    expect(shrineDiscovered).toEqual(["bp_shrine_event"]);
  });

  it("forges only found and un-forged blueprint with enough shards", () => {
    const meta = {
      ...createInitialMeta(),
      soulShards: 50,
      blueprintFoundIds: ["bp_sword_rare"],
      blueprintForgedIds: []
    };
    expect(canForgeBlueprint(meta, BLUEPRINTS[0]!)).toBe(true);

    const forged = forgeBlueprint(meta, BLUEPRINTS[0]!);
    expect(forged.soulShards).toBe(30);
    expect(forged.totalShardsSpent).toBe(meta.totalShardsSpent + 20);
    expect(forged.blueprintForgedIds).toEqual(["bp_sword_rare"]);

    const forgedAgain = forgeBlueprint(forged, BLUEPRINTS[0]!);
    expect(forgedAgain).toEqual(forged);
  });
});
