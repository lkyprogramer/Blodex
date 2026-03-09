import { describe, expect, it } from "vitest";
import { deriveStats } from "../stats";
import type { ItemInstance } from "../contracts/types";

describe("deriveStats regression", () => {
  it("keeps baseline coefficients stable", () => {
    const base = {
      strength: 8,
      dexterity: 8,
      vitality: 8,
      intelligence: 5
    };

    expect(deriveStats(base, [])).toEqual({
      maxHealth: 244,
      maxMana: 90,
      armor: 12,
      attackPower: 25.6,
      critChance: 0.0398,
      attackSpeed: 1.014,
      moveSpeed: 142.24
    });
  });

  it("applies equipment affixes additively and caps crit chance", () => {
    const base = {
      strength: 10,
      dexterity: 10,
      vitality: 10,
      intelligence: 6
    };

    const items: ItemInstance[] = [
      {
        id: "weapon-1",
        defId: "weapon",
        name: "Weapon",
        slot: "weapon",
        rarity: "rare",
        requiredLevel: 1,
        iconId: "icon_weapon",
        seed: "seed-1",
        rolledAffixes: {
          attackPower: 20,
          critChance: 0.3
        }
      },
      {
        id: "ring-1",
        defId: "ring",
        name: "Ring",
        slot: "ring",
        rarity: "magic",
        requiredLevel: 1,
        iconId: "icon_ring",
        seed: "seed-2",
        rolledAffixes: {
          critChance: 0.4,
          maxHealth: 18
        }
      }
    ];

    const stats = deriveStats(base, items);
    expect(stats.attackPower).toBe(50);
    expect(stats.maxHealth).toBe(298);
    expect(stats.critChance).toBe(0.5);
  });

  it("applies item set effects on top of equipment affixes", () => {
    const base = {
      strength: 10,
      dexterity: 10,
      vitality: 10,
      intelligence: 6
    };
    const items: ItemInstance[] = [
      {
        id: "weapon-1",
        defId: "emberbrand_edge",
        name: "Emberbrand Edge",
        slot: "weapon",
        kind: "unique",
        setId: "ember_vow",
        rarity: "rare",
        requiredLevel: 5,
        iconId: "item_weapon_03",
        seed: "seed-weapon",
        rolledAffixes: {
          attackPower: 12
        }
      },
      {
        id: "ring-1",
        defId: "cindersigil_band",
        name: "Cindersigil Band",
        slot: "ring",
        kind: "unique",
        setId: "ember_vow",
        rarity: "rare",
        requiredLevel: 5,
        iconId: "item_ring_02",
        seed: "seed-ring",
        rolledAffixes: {
          attackPower: 8
        }
      }
    ];

    const withoutSet = deriveStats(base, items);
    const withSet = deriveStats(base, items, undefined, {
      startingHealth: 0,
      startingArmor: 0,
      luckBonus: 0,
      skillSlots: 0,
      potionCharges: 0
    }, undefined, {
      derivedFlat: {
        attackPower: 6,
        moveSpeed: 6
      },
      derivedPercent: {}
    });

    expect(withSet.attackPower).toBe(withoutSet.attackPower + 6);
    expect(withSet.moveSpeed).toBe(withoutSet.moveSpeed + 6);
  });
});
