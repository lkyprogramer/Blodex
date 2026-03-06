import type { ItemInstance } from "@blodex/core";
import { describe, expect, it } from "vitest";
import { buildEquipmentDeltaSummary } from "../EquipmentDeltaPresenter";
import { isMerchantHighValueCompareCandidate } from "../EquipmentCompareViewPresenter";

function makeItem(partial: Partial<ItemInstance>): ItemInstance {
  return {
    id: "item-a",
    defId: "item_def",
    name: "Test Item",
    slot: "weapon",
    rarity: "magic",
    requiredLevel: 1,
    iconId: "item_weapon_01",
    seed: "seed",
    rolledAffixes: {
      attackPower: 0,
      armor: 0,
      maxMana: 0,
      critChance: 0
    },
    ...(partial ?? {})
  };
}

describe("EquipmentDeltaPresenter", () => {
  it("builds offense/defense/utility directions from item delta", () => {
    const candidate = makeItem({
      rolledAffixes: {
        attackPower: 16,
        armor: 2,
        maxMana: 3,
        critChance: 0.08
      }
    });
    const equipped = makeItem({
      id: "equipped",
      rolledAffixes: {
        attackPower: 10,
        armor: 6,
        maxMana: 1,
        critChance: 0.03
      }
    });

    const summary = buildEquipmentDeltaSummary(candidate, equipped);

    expect(summary).toEqual([
      expect.objectContaining({ key: "offense", direction: "up" }),
      expect.objectContaining({ key: "defense", direction: "down" }),
      expect.objectContaining({ key: "utility", direction: "up" })
    ]);
  });

  it("returns equal directions when there is no compare item", () => {
    const candidate = makeItem({});
    const summary = buildEquipmentDeltaSummary(candidate, undefined);
    expect(summary.every((entry) => entry.direction === "equal")).toBe(true);
  });

  it("treats only materially better merchant upgrades as high-value compare candidates", () => {
    const lowValueCandidate = makeItem({
      rolledAffixes: {
        attackPower: 5,
        armor: 0,
        maxMana: 0,
        critChance: 0
      }
    });
    const equipped = makeItem({
      id: "equipped",
      rolledAffixes: {
        attackPower: 4,
        armor: 1,
        maxMana: 0,
        critChance: 0
      }
    });
    const highValueCandidate = makeItem({
      id: "item-b",
      rolledAffixes: {
        attackPower: 12,
        armor: 3,
        maxMana: 4,
        critChance: 0.08
      }
    });

    expect(isMerchantHighValueCompareCandidate(lowValueCandidate, equipped)).toBe(false);
    expect(isMerchantHighValueCompareCandidate(highValueCandidate, equipped)).toBe(true);
    expect(isMerchantHighValueCompareCandidate(highValueCandidate, undefined)).toBe(false);
  });
});
