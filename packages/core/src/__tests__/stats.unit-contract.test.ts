import { describe, expect, it } from "vitest";
import type { ItemDef, LootTableDef } from "../contracts/types";
import { rollItemDrop } from "../loot";
import { SeededRng } from "../rng";
import { resolveSpecialAffixTotals } from "../specialAffix";

describe("stats unit contract", () => {
  it("normalizes legacy critChance percent points to ratio when rolling affixes", () => {
    const itemDefs: Record<string, ItemDef> = {
      ring: {
        id: "ring",
        name: "Legacy Ring",
        slot: "ring",
        rarity: "magic",
        requiredLevel: 1,
        iconId: "icon_ring",
        minAffixes: 1,
        maxAffixes: 1,
        affixPool: [{ key: "critChance", min: 1, max: 1 }]
      },
      unique_ring: {
        id: "unique_ring",
        name: "Legacy Unique Ring",
        kind: "unique",
        slot: "ring",
        rarity: "rare",
        requiredLevel: 1,
        iconId: "icon_ring",
        minAffixes: 0,
        maxAffixes: 0,
        affixPool: [],
        fixedAffixes: {
          critChance: 4
        }
      }
    };
    const normalTable: LootTableDef = {
      id: "normal",
      entries: [{ itemDefId: "ring", minFloor: 1, weight: 1 }]
    };
    const uniqueTable: LootTableDef = {
      id: "unique",
      entries: [{ itemDefId: "unique_ring", minFloor: 1, weight: 1 }]
    };

    const normal = rollItemDrop(normalTable, itemDefs, 1, new SeededRng("crit-normal"), "normal");
    const unique = rollItemDrop(uniqueTable, itemDefs, 1, new SeededRng("crit-unique"), "unique");

    expect(normal?.rolledAffixes.critChance).toBeCloseTo(0.01);
    expect(unique?.rolledAffixes.critChance).toBeCloseTo(0.04);
  });

  it("normalizes all special affix keys into runtime contract units", () => {
    const totals = resolveSpecialAffixTotals([
      {
        id: "affix-probe",
        defId: "affix-probe",
        name: "Affix Probe",
        slot: "ring",
        rarity: "rare",
        requiredLevel: 1,
        iconId: "icon_ring",
        seed: "probe",
        rolledAffixes: {},
        rolledSpecialAffixes: {
          lifesteal: 6,
          critDamage: 22,
          aoeRadius: 18,
          damageOverTime: 7,
          thorns: 9,
          healthRegen: 6,
          dodgeChance: 9,
          xpBonus: 18,
          soulShardBonus: 15,
          cooldownReduction: 14
        }
      }
    ]);

    expect(totals.lifesteal).toBeCloseTo(0.06);
    expect(totals.critDamage).toBeCloseTo(0.22);
    expect(totals.aoeRadius).toBeCloseTo(0.18);
    expect(totals.damageOverTime).toBeCloseTo(7);
    expect(totals.thorns).toBeCloseTo(0.09);
    expect(totals.healthRegen).toBeCloseTo(6);
    expect(totals.dodgeChance).toBeCloseTo(0.09);
    expect(totals.xpBonus).toBeCloseTo(0.18);
    expect(totals.soulShardBonus).toBeCloseTo(0.15);
    expect(totals.cooldownReduction).toBeCloseTo(0.14);
  });
});
