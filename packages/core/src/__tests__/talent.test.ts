import { describe, expect, it } from "vitest";
import type { MetaProgression, TalentNodeDef } from "../contracts/types";
import {
  canPurchaseTalent,
  collectTalentEffectTotals,
  derivePermanentUpgradesFromTalents,
  mapLegacyPermanentUpgradesToTalents,
  purchaseTalent
} from "../talent";
import { createInitialMeta } from "../run";

const TALENTS: TalentNodeDef[] = [
  {
    id: "core_vitality_training",
    path: "core",
    tier: 0,
    name: "Vitality Training",
    description: "",
    cost: 24,
    maxRank: 1,
    prerequisites: [],
    effects: [{ type: "derived_stat_flat", stat: "maxHealth", value: 10 }],
    uiPosition: { x: 0, y: 0 }
  },
  {
    id: "utility_skill_slot_i",
    path: "utility",
    tier: 1,
    name: "Third Slot",
    description: "",
    cost: 30,
    maxRank: 1,
    prerequisites: [{ talentId: "core_vitality_training", minRank: 1 }],
    effects: [{ type: "capacity", key: "skillSlots", value: 1 }],
    uiPosition: { x: 0, y: 0 }
  }
];

const AGGREGATION_TALENTS: TalentNodeDef[] = [
  ...TALENTS,
  {
    id: "warrior_blooded_edge",
    path: "warrior",
    tier: 0,
    name: "Blooded Edge",
    description: "",
    cost: 36,
    maxRank: 1,
    prerequisites: [],
    effects: [{ type: "base_stat_flat", stat: "strength", value: 2 }],
    uiPosition: { x: 0, y: 0 }
  }
];

describe("talent", () => {
  it("derives legacy permanent upgrades from mapped talents", () => {
    const upgrades = derivePermanentUpgradesFromTalents({
      core_vitality_training: 1,
      core_iron_skin: 1,
      core_keen_eye: 1,
      utility_skill_slot_i: 1,
      utility_skill_slot_ii: 1,
      utility_potion_satchel: 1
    });

    expect(upgrades).toEqual({
      startingHealth: 10,
      startingArmor: 2,
      luckBonus: 0.05,
      skillSlots: 4,
      potionCharges: 1
    });
  });

  it("maps legacy permanent upgrades to talent points", () => {
    const points = mapLegacyPermanentUpgradesToTalents({
      startingHealth: 10,
      startingArmor: 2,
      luckBonus: 0.05,
      skillSlots: 4,
      potionCharges: 1
    });

    expect(points).toMatchObject({
      core_vitality_training: 1,
      core_iron_skin: 1,
      core_keen_eye: 1,
      utility_skill_slot_i: 1,
      utility_skill_slot_ii: 1,
      utility_potion_satchel: 1
    });
  });

  it("checks purchase gating and applies rank + shard spend", () => {
    const meta: MetaProgression = {
      ...createInitialMeta(),
      soulShards: 60
    };

    expect(canPurchaseTalent(meta, TALENTS[1]!)).toBe(false);

    const afterFirst = purchaseTalent(meta, TALENTS[0]!);
    expect(afterFirst.soulShards).toBe(36);
    expect(afterFirst.talentPoints.core_vitality_training).toBe(1);
    expect(afterFirst.totalShardsSpent).toBe(24);

    const afterSecond = purchaseTalent(afterFirst, TALENTS[1]!);
    expect(afterSecond.soulShards).toBe(6);
    expect(afterSecond.talentPoints.utility_skill_slot_i).toBe(1);
    expect(afterSecond.totalShardsSpent).toBe(54);
    expect(afterSecond.permanentUpgrades.skillSlots).toBe(3);
  });

  it("aggregates typed effects by purchased ranks", () => {
    const totals = collectTalentEffectTotals(
      {
        core_vitality_training: 1,
        utility_skill_slot_i: 1,
        warrior_blooded_edge: 1
      },
      AGGREGATION_TALENTS
    );

    expect(totals.derivedFlat.maxHealth).toBeUndefined();
    expect(totals.capacity.skillSlots).toBeUndefined();
    expect(totals.baseStats.strength).toBe(2);
  });
});
