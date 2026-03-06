import type { SkillDef } from "./types";

export const SKILL_DEFS: SkillDef[] = [
  {
    id: "cleave",
    name: "Cleave",
    description: "Wide sweeping strike around the player.",
    icon: "skill_cleave",
    archetype: "warrior",
    cooldownMs: 3000,
    manaCost: 8,
    damageType: "physical",
    targeting: "aoe_around",
    range: 1.5,
    effects: [{ type: "damage", value: { base: 0, scaling: "strength", ratio: 1.2 } }]
  },
  {
    id: "war_cry",
    name: "War Cry",
    description: "Increase attack power and attack speed.",
    icon: "skill_war_cry",
    archetype: "warrior",
    cooldownMs: 9000,
    manaCost: 10,
    damageType: "physical",
    targeting: "self",
    range: 0,
    effects: [{ type: "buff", value: 1, duration: 6000, buffId: "war_cry" }]
  },
  {
    id: "shield_slam",
    name: "Shield Slam",
    description: "Heavy bash that knocks nearby enemies.",
    icon: "skill_shield_slam",
    archetype: "warrior",
    cooldownMs: 4800,
    manaCost: 12,
    damageType: "physical",
    targeting: "nearest",
    range: 2.5,
    effects: [{ type: "damage", value: { base: 12, scaling: "strength", ratio: 1.0 } }]
  },
  {
    id: "quake_strike",
    name: "Quake Strike",
    description: "Ground smash with a short shockwave.",
    icon: "skill_quake_strike",
    archetype: "warrior",
    cooldownMs: 5600,
    manaCost: 14,
    damageType: "physical",
    targeting: "aoe_around",
    range: 2.2,
    effects: [{ type: "damage", value: { base: 14, scaling: "strength", ratio: 1.1 }, radius: 2.2 }]
  },
  {
    id: "execution_drive",
    name: "Execution Drive",
    description: "Finisher thrust focused on one target.",
    icon: "skill_execution_drive",
    archetype: "warrior",
    cooldownMs: 5000,
    manaCost: 16,
    damageType: "physical",
    targeting: "nearest",
    range: 2.8,
    effects: [{ type: "damage", value: { base: 16, scaling: "strength", ratio: 1.3 } }]
  },
  {
    id: "shadow_step",
    name: "Shadow Step",
    description: "Blink to a nearby enemy and guarantee a critical hit.",
    icon: "skill_shadow_step",
    archetype: "ranger",
    cooldownMs: 3200,
    manaCost: 12,
    damageType: "physical",
    targeting: "nearest",
    range: 6,
    effects: [{ type: "buff", value: 1, duration: 3000, buffId: "guaranteed_crit" }]
  },
  {
    id: "blade_fan",
    name: "Blade Fan",
    description: "Throw blades in a short cone.",
    icon: "skill_blade_fan",
    archetype: "ranger",
    cooldownMs: 4000,
    manaCost: 11,
    damageType: "physical",
    targeting: "aoe_around",
    range: 2.4,
    effects: [{ type: "damage", value: { base: 8, scaling: "dexterity", ratio: 1.0 } }]
  },
  {
    id: "mark_prey",
    name: "Mark Prey",
    description: "Expose an enemy and strike for bonus damage.",
    icon: "skill_mark_prey",
    archetype: "ranger",
    cooldownMs: 5200,
    manaCost: 13,
    damageType: "physical",
    targeting: "nearest",
    range: 6.5,
    effects: [{ type: "damage", value: { base: 10, scaling: "dexterity", ratio: 1.25 } }]
  },
  {
    id: "venom_volley",
    name: "Venom Volley",
    description: "Poisoned projectiles over a small area.",
    icon: "skill_venom_volley",
    archetype: "ranger",
    cooldownMs: 5600,
    manaCost: 14,
    damageType: "physical",
    targeting: "aoe_around",
    range: 2.8,
    effects: [{ type: "damage", value: { base: 9, scaling: "dexterity", ratio: 1.15 } }]
  },
  {
    id: "wind_dash",
    name: "Wind Dash",
    description: "Rapid dash and slash nearest target.",
    icon: "skill_wind_dash",
    archetype: "ranger",
    cooldownMs: 3800,
    manaCost: 10,
    damageType: "physical",
    targeting: "nearest",
    range: 5.5,
    effects: [{ type: "damage", value: { base: 7, scaling: "dexterity", ratio: 1.3 } }]
  },
  {
    id: "blood_drain",
    name: "Blood Drain",
    description: "Drain life from the nearest enemy.",
    icon: "skill_blood_drain",
    archetype: "arcanist",
    cooldownMs: 4500,
    manaCost: 15,
    damageType: "arcane",
    targeting: "nearest",
    range: 3,
    effects: [
      { type: "damage", value: { base: 0, scaling: "intelligence", ratio: 0.9 } },
      { type: "heal", value: { base: 0, scaling: "intelligence", ratio: 0.8 } }
    ]
  },
  {
    id: "frost_nova",
    name: "Frost Nova",
    description: "Apply a slowing shockwave around you.",
    icon: "skill_frost_nova",
    archetype: "arcanist",
    cooldownMs: 5200,
    manaCost: 20,
    damageType: "arcane",
    targeting: "aoe_around",
    range: 2,
    effects: [{ type: "debuff", value: 0.5, duration: 3000, radius: 2, buffId: "frost_slow" }]
  },
  {
    id: "chain_lightning",
    name: "Chain Lightning",
    description: "Arcane bolt that tears through targets.",
    icon: "skill_chain_lightning",
    archetype: "arcanist",
    cooldownMs: 4200,
    manaCost: 16,
    damageType: "arcane",
    targeting: "nearest",
    range: 6,
    effects: [{ type: "damage", value: { base: 12, scaling: "intelligence", ratio: 1.15 } }]
  },
  {
    id: "spirit_burst",
    name: "Spirit Burst",
    description: "Release nearby spirits in a circular blast.",
    icon: "skill_spirit_burst",
    archetype: "arcanist",
    cooldownMs: 5600,
    manaCost: 18,
    damageType: "arcane",
    targeting: "aoe_around",
    range: 2.4,
    effects: [{ type: "damage", value: { base: 14, scaling: "intelligence", ratio: 1.1 } }]
  },
  {
    id: "rift_step",
    name: "Rift Step",
    description: "Arcane rift blink and strike.",
    icon: "skill_rift_step",
    archetype: "arcanist",
    cooldownMs: 3600,
    manaCost: 14,
    damageType: "arcane",
    targeting: "nearest",
    range: 7,
    effects: [{ type: "damage", value: { base: 10, scaling: "intelligence", ratio: 1.3 } }]
  }
];

export const SKILL_DEF_MAP = Object.fromEntries(SKILL_DEFS.map((entry) => [entry.id, entry])) as Record<
  SkillDef["id"],
  SkillDef
>;
