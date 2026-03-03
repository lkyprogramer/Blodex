import { describe, expect, it } from "vitest";
import type { ItemInstance, SynergyDef } from "../contracts/types";
import { createInitialMeta } from "../run";
import {
  collectActiveSynergies,
  isSynergyConditionMet,
  mergeSynergyDiscoveries,
  resolveSynergyRuntimeEffects,
  type SynergyRuntimeContext
} from "../synergy";

const EQUIPMENT_WITH_CDR: ItemInstance = {
  id: "ring-1",
  defId: "ring_of_focus",
  name: "Ring of Focus",
  slot: "ring",
  rarity: "rare",
  requiredLevel: 1,
  iconId: "ring_icon",
  seed: "seed",
  rolledAffixes: {},
  rolledSpecialAffixes: {
    cooldownReduction: 0.1
  }
};

const CONTEXT: SynergyRuntimeContext = {
  weaponType: "staff",
  activeSkills: [
    { id: "chain_lightning", level: 2 },
    { id: "frost_nova", level: 1 }
  ],
  talentPoints: {
    core_keen_eye: 1
  },
  selectedMutationIds: ["mut_berserk_echo"],
  equipment: [EQUIPMENT_WITH_CDR]
};

const SYNERGIES: SynergyDef[] = [
  {
    id: "syn_staff_chain",
    category: "weapon_skill",
    conditions: [
      { type: "weapon_type", value: "staff" },
      { type: "skill_equipped", value: "chain_lightning" }
    ],
    effects: [{ type: "skill_damage_percent", skillId: "chain_lightning", value: 0.2 }]
  },
  {
    id: "syn_cdr_chain",
    category: "equipment",
    conditions: [
      { type: "special_affix_at_least", key: "cooldownReduction", value: 0.08 },
      { type: "skill_level_at_least", skillId: "chain_lightning", level: 2 }
    ],
    effects: [{ type: "cooldown_override", key: "chain_lightning", valueMs: 5200 }]
  }
];

describe("synergy", () => {
  it("evaluates typed conditions", () => {
    expect(isSynergyConditionMet({ type: "weapon_type", value: "staff" }, CONTEXT)).toBe(true);
    expect(isSynergyConditionMet({ type: "skill_level_at_least", skillId: "chain_lightning", level: 2 }, CONTEXT)).toBe(
      true
    );
    expect(isSynergyConditionMet({ type: "mutation_equipped", value: "missing_mutation" }, CONTEXT)).toBe(false);
  });

  it("collects active synergies and resolves effects", () => {
    const active = collectActiveSynergies(SYNERGIES, CONTEXT);
    expect(active.map((entry) => entry.id)).toEqual(["syn_staff_chain", "syn_cdr_chain"]);
    const effects = resolveSynergyRuntimeEffects(SYNERGIES, CONTEXT);
    expect(effects.skillDamagePercent.chain_lightning).toBeCloseTo(0.2);
    expect(effects.cooldownOverridesMs.chain_lightning).toBe(5200);
  });

  it("writes discoveries once", () => {
    const meta = createInitialMeta();
    const once = mergeSynergyDiscoveries(meta, ["syn_staff_chain", "syn_cdr_chain"]);
    const twice = mergeSynergyDiscoveries(once, ["syn_staff_chain"]);
    expect(once.synergyDiscoveredIds).toEqual(["syn_staff_chain", "syn_cdr_chain"]);
    expect(twice.synergyDiscoveredIds).toEqual(["syn_staff_chain", "syn_cdr_chain"]);
  });
});
