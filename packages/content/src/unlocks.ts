import type { UnlockDef } from "./types";

export const UNLOCK_DEFS: UnlockDef[] = [
  {
    id: "u_starting_hp_10",
    name: "Hardened Flesh",
    description: "+10 starting health.",
    tier: 1,
    cost: 10,
    cumulativeRequirement: 0,
    effect: {
      type: "permanent_upgrade",
      key: "startingHealth",
      value: 10
    }
  },
  {
    id: "u_unlock_cleave",
    name: "Unlock Cleave",
    description: "Unlock Cleave skill in reward pool.",
    tier: 1,
    cost: 15,
    cumulativeRequirement: 0,
    effect: {
      type: "skill_unlock",
      skillId: "cleave"
    }
  },
  {
    id: "u_skill_slot_3",
    name: "Third Skill Slot",
    description: "Increase skill slots to 3.",
    tier: 2,
    cost: 30,
    cumulativeRequirement: 50,
    effect: {
      type: "permanent_upgrade",
      key: "skillSlots",
      value: 1
    }
  },
  {
    id: "u_skill_slot_4",
    name: "Fourth Skill Slot",
    description: "Increase skill slots to 4.",
    tier: 3,
    cost: 50,
    cumulativeRequirement: 150,
    effect: {
      type: "permanent_upgrade",
      key: "skillSlots",
      value: 1
    }
  },
  {
    id: "u_starting_armor_2",
    name: "Steel Skin",
    description: "+2 starting armor.",
    tier: 2,
    cost: 20,
    cumulativeRequirement: 50,
    effect: {
      type: "permanent_upgrade",
      key: "startingArmor",
      value: 2
    }
  },
  {
    id: "u_luck_bonus_5",
    name: "Fortune's Eye",
    description: "+5% crit/luck baseline.",
    tier: 3,
    cost: 40,
    cumulativeRequirement: 150,
    effect: {
      type: "permanent_upgrade",
      key: "luckBonus",
      value: 0.05
    }
  },
  {
    id: "u_potion_charge_1",
    name: "Potion Charge",
    description: "+1 potion charge.",
    tier: 3,
    cost: 45,
    cumulativeRequirement: 150,
    effect: {
      type: "permanent_upgrade",
      key: "potionCharges",
      value: 1
    }
  },
  {
    id: "u_unlock_shadow_step",
    name: "Unlock Shadow Step",
    description: "Unlock Shadow Step skill.",
    tier: 2,
    cost: 25,
    cumulativeRequirement: 50,
    effect: {
      type: "skill_unlock",
      skillId: "shadow_step"
    }
  }
];

export const UNLOCK_DEF_MAP = Object.fromEntries(UNLOCK_DEFS.map((entry) => [entry.id, entry])) as Record<
  UnlockDef["id"],
  UnlockDef
>;
