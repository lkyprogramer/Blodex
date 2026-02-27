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
  },
  {
    id: "u_unlock_affix_frenzied",
    name: "Affix: Frenzied",
    description: "Enable frenzied monsters in advanced floors.",
    tier: 1,
    cost: 18,
    cumulativeRequirement: 0,
    effect: {
      type: "affix_unlock",
      affixId: "frenzied"
    }
  },
  {
    id: "u_unlock_affix_armored",
    name: "Affix: Armored",
    description: "Enable armored monsters in advanced floors.",
    tier: 1,
    cost: 18,
    cumulativeRequirement: 0,
    effect: {
      type: "affix_unlock",
      affixId: "armored"
    }
  },
  {
    id: "u_unlock_event_merchant",
    name: "Event: Wandering Merchant",
    description: "Allow merchant encounters during runs.",
    tier: 2,
    cost: 24,
    cumulativeRequirement: 50,
    effect: {
      type: "event_unlock",
      eventId: "wandering_merchant"
    }
  },
  {
    id: "u_unlock_affix_vampiric",
    name: "Affix: Vampiric",
    description: "Enable vampiric monsters.",
    tier: 2,
    cost: 34,
    cumulativeRequirement: 70,
    effect: {
      type: "affix_unlock",
      affixId: "vampiric"
    }
  },
  {
    id: "u_unlock_affix_splitting",
    name: "Affix: Splitting",
    description: "Enable splitting monsters.",
    tier: 3,
    cost: 52,
    cumulativeRequirement: 130,
    effect: {
      type: "affix_unlock",
      affixId: "splitting"
    }
  },
  {
    id: "u_unlock_event_unstable_portal",
    name: "Event: Unstable Portal",
    description: "Allow unstable portal events.",
    tier: 3,
    cost: 48,
    cumulativeRequirement: 130,
    effect: {
      type: "event_unlock",
      eventId: "unstable_portal"
    }
  }
];

export const UNLOCK_DEF_MAP = Object.fromEntries(UNLOCK_DEFS.map((entry) => [entry.id, entry])) as Record<
  UnlockDef["id"],
  UnlockDef
>;
