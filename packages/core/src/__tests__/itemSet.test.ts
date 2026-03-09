import { describe, expect, it } from "vitest";
import type { ItemInstance, ItemSetDef } from "../contracts/types";
import {
  countEquippedItemSetPieces,
  resolveEquippedItemSetEffects,
  resolveItemSetTransition
} from "../itemSet";
import { deriveStats } from "../stats";

const TEST_SET_DEFS: ItemSetDef[] = [
  {
    id: "ember_vow",
    name: "Ember Vow",
    theme: "offense",
    associatedDamageType: "fire",
    itemIds: ["emberbrand_edge", "cindersigil_band", "ashwake_treads"],
    bonuses: [
      {
        pieces: 2,
        derivedFlat: {
          attackPower: 6,
          moveSpeed: 6
        }
      },
      {
        pieces: 3,
        derivedFlat: {
          attackSpeed: 0.05,
          critChance: 0.04
        }
      }
    ]
  }
];

function makeSetItem(
  defId: string,
  slot: ItemInstance["slot"],
  setId: ItemInstance["setId"],
  rolledAffixes: ItemInstance["rolledAffixes"] = {}
): ItemInstance {
  return {
    id: `${defId}-instance`,
    defId,
    name: defId,
    slot,
    kind: "unique",
    rarity: "rare",
    requiredLevel: 5,
    iconId: defId,
    seed: `${defId}-seed`,
    rolledAffixes,
    ...(setId === undefined ? {} : { setId })
  };
}

describe("item set foundations", () => {
  it("counts equipped set pieces and resolves active thresholds", () => {
    const equipped = [
      makeSetItem("emberbrand_edge", "weapon", "ember_vow"),
      makeSetItem("cindersigil_band", "ring", "ember_vow"),
      makeSetItem("judicator_crown", "helm", "judicator_regalia")
    ];

    const counts = countEquippedItemSetPieces(equipped);
    const effects = resolveEquippedItemSetEffects(equipped, TEST_SET_DEFS);

    expect(counts.ember_vow).toBe(2);
    expect(effects.activeSetIds).toContain("ember_vow");
    expect(effects.activeThresholdsBySetId.ember_vow).toEqual([2]);
    expect(effects.associatedDamageTypes).toContain("fire");
    expect(effects.derivedFlat.attackPower).toBe(6);
    expect(effects.derivedFlat.moveSpeed).toBe(6);
  });

  it("feeds set bonuses into deriveStats", () => {
    const baseStats = {
      strength: 8,
      dexterity: 8,
      vitality: 8,
      intelligence: 5
    };
    const equipped = [
      makeSetItem("emberbrand_edge", "weapon", "ember_vow"),
      makeSetItem("cindersigil_band", "ring", "ember_vow")
    ];
    const withoutSet = deriveStats(baseStats, equipped);
    const withSet = deriveStats(
      baseStats,
      equipped,
      undefined,
      undefined,
      undefined,
      resolveEquippedItemSetEffects(equipped, TEST_SET_DEFS)
    );

    expect(withSet.attackPower).toBeGreaterThan(withoutSet.attackPower);
    expect(withSet.moveSpeed).toBeGreaterThan(withoutSet.moveSpeed);
  });

  it("computes set transition when equipping into a 2-piece threshold", () => {
    const compareItem: ItemInstance = {
      id: "plain-ring-instance",
      defId: "plain_ring",
      name: "plain_ring",
      slot: "ring",
      kind: "equipment",
      rarity: "magic",
      requiredLevel: 1,
      iconId: "plain_ring",
      seed: "plain-ring-seed",
      rolledAffixes: {}
    };
    const candidate = makeSetItem("cindersigil_band", "ring", "ember_vow");
    const equipped = [makeSetItem("emberbrand_edge", "weapon", "ember_vow")];

    const transition = resolveItemSetTransition(candidate, compareItem, equipped, TEST_SET_DEFS);

    expect(transition).toMatchObject({
      setId: "ember_vow",
      beforePieces: 1,
      afterPieces: 2,
      activatedThresholds: [2]
    });
  });

  it("computes set transition when replacing a set piece with a non-set item", () => {
    const compareItem = makeSetItem("cindersigil_band", "ring", "ember_vow");
    const candidate: ItemInstance = {
      id: "plain-ring-instance",
      defId: "plain_ring",
      name: "plain_ring",
      slot: "ring",
      kind: "equipment",
      rarity: "magic",
      requiredLevel: 1,
      iconId: "plain_ring",
      seed: "plain-ring-seed",
      rolledAffixes: {}
    };
    const equipped = [makeSetItem("emberbrand_edge", "weapon", "ember_vow")];

    const transition = resolveItemSetTransition(candidate, compareItem, equipped, TEST_SET_DEFS);

    expect(transition).toMatchObject({
      setId: "ember_vow",
      beforePieces: 2,
      afterPieces: 1,
      lostThresholds: [2]
    });
  });
});
