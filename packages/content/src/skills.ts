import type { SkillDef } from "./types";

export const SKILL_DEFS: SkillDef[] = [
  {
    id: "cleave",
    name: "Cleave",
    description: "Wide sweeping strike around the player.",
    icon: "skill_cleave",
    cooldownMs: 3000,
    manaCost: 8,
    damageType: "physical",
    targeting: "aoe_around",
    range: 1.5,
    effects: [
      {
        type: "damage",
        value: { base: 0, scaling: "strength", ratio: 1.2 }
      }
    ]
  },
  {
    id: "shadow_step",
    name: "Shadow Step",
    description: "Blink to a nearby enemy and guarantee a critical hit.",
    icon: "skill_shadow_step",
    cooldownMs: 5000,
    manaCost: 12,
    damageType: "physical",
    targeting: "nearest",
    range: 6,
    effects: [
      {
        type: "buff",
        value: 1,
        duration: 3000,
        buffId: "guaranteed_crit"
      }
    ]
  },
  {
    id: "blood_drain",
    name: "Blood Drain",
    description: "Drain life from the nearest enemy.",
    icon: "skill_blood_drain",
    cooldownMs: 8000,
    manaCost: 15,
    damageType: "arcane",
    targeting: "nearest",
    range: 3,
    effects: [
      {
        type: "damage",
        value: { base: 0, scaling: "strength", ratio: 0.8 }
      },
      {
        type: "heal",
        value: { base: 0, scaling: "strength", ratio: 0.8 }
      }
    ]
  },
  {
    id: "frost_nova",
    name: "Frost Nova",
    description: "Apply a slowing shockwave around you.",
    icon: "skill_frost_nova",
    cooldownMs: 10000,
    manaCost: 20,
    damageType: "arcane",
    targeting: "aoe_around",
    range: 2,
    effects: [
      {
        type: "debuff",
        value: 0.5,
        duration: 3000,
        radius: 2,
        buffId: "frost_slow"
      }
    ]
  },
  {
    id: "war_cry",
    name: "War Cry",
    description: "Increase attack power and attack speed.",
    icon: "skill_war_cry",
    cooldownMs: 15000,
    manaCost: 10,
    damageType: "physical",
    targeting: "self",
    range: 0,
    effects: [
      {
        type: "buff",
        value: 1,
        duration: 6000,
        buffId: "war_cry"
      }
    ]
  }
];

export const SKILL_DEF_MAP = Object.fromEntries(SKILL_DEFS.map((entry) => [entry.id, entry])) as Record<
  SkillDef["id"],
  SkillDef
>;
