import { describe, expect, it } from "vitest";
import { calculateItemPowerScore, collectItemAffixMap } from "../itemTradeoff";

describe("itemTradeoff", () => {
  it("normalizes legacy critChance percent points before scoring", () => {
    const item = {
      id: "legacy-ring",
      defId: "legacy-ring",
      name: "Legacy Ring",
      slot: "ring",
      rarity: "rare",
      requiredLevel: 1,
      iconId: "item_ring_01",
      seed: "legacy",
      rolledAffixes: {
        critChance: 2
      },
      rolledSpecialAffixes: {}
    } as const;

    expect(collectItemAffixMap(item).get("critChance")).toBeCloseTo(0.02);
    expect(calculateItemPowerScore(item)).toBeCloseTo(3.2);
  });
});
