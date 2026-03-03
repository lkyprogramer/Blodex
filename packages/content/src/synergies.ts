import type { SynergyDef } from "./types";

export const SYNERGY_DEFS: SynergyDef[] = [
  {
    id: "syn_staff_chain_lightning_overload",
    category: "weapon_skill",
    conditions: [
      { type: "weapon_type", value: "staff" },
      { type: "skill_equipped", value: "chain_lightning" }
    ],
    effects: [{ type: "skill_damage_percent", skillId: "chain_lightning", value: 0.25 }]
  },
  {
    id: "syn_dagger_shadow_step_ambush",
    category: "weapon_skill",
    conditions: [
      { type: "weapon_type", value: "dagger" },
      { type: "skill_level_at_least", skillId: "shadow_step", level: 2 }
    ],
    effects: [{ type: "cooldown_override", key: "shadow_step", valueMs: 3200 }]
  },
  {
    id: "syn_frost_spirit_resonance",
    category: "skill_skill",
    conditions: [
      { type: "skill_equipped", value: "frost_nova" },
      { type: "skill_equipped", value: "spirit_burst" }
    ],
    effects: [
      { type: "skill_modifier", skillId: "frost_nova", key: "radius", value: 0.35 },
      { type: "skill_modifier", skillId: "spirit_burst", key: "radius", value: 0.35 }
    ]
  },
  {
    id: "syn_quake_hammer_shock",
    category: "weapon_skill",
    conditions: [
      { type: "weapon_type", value: "hammer" },
      { type: "skill_equipped", value: "quake_strike" }
    ],
    effects: [{ type: "skill_damage_percent", skillId: "quake_strike", value: 0.2 }]
  },
  {
    id: "syn_keen_berserk_velocity",
    category: "talent_mutation",
    conditions: [
      { type: "talent_rank_at_least", talentId: "core_keen_eye", rank: 1 },
      { type: "mutation_equipped", value: "mut_berserk_echo" }
    ],
    effects: [{ type: "stat_percent", stat: "attackSpeed", value: 0.12 }]
  },
  {
    id: "syn_cdr_chain_window",
    category: "equipment",
    conditions: [
      { type: "special_affix_at_least", key: "cooldownReduction", value: 0.08 },
      { type: "skill_equipped", value: "chain_lightning" }
    ],
    effects: [{ type: "cooldown_override", key: "chain_lightning", valueMs: 5200 }]
  }
];

export const SYNERGY_DEF_MAP = Object.fromEntries(SYNERGY_DEFS.map((entry) => [entry.id, entry])) as Record<
  SynergyDef["id"],
  SynergyDef
>;
