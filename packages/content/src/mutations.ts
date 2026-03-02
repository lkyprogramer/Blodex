import type { MutationDef } from "./types";

const OFFENSIVE_MUTATIONS: MutationDef[] = [
  {
    id: "mut_battle_instinct",
    name: "Battle Instinct",
    category: "offensive",
    tier: 1,
    unlock: { type: "default" },
    effects: [{ type: "on_kill_attack_speed", value: 0.05, durationMs: 3200, maxStacks: 2 }]
  },
  {
    id: "mut_berserk_echo",
    name: "Berserk Echo",
    category: "offensive",
    tier: 1,
    unlock: { type: "blueprint", blueprintId: "bp_mutation_berserk_echo" },
    effects: [{ type: "on_kill_attack_speed", value: 0.08, durationMs: 4200, maxStacks: 4 }]
  },
  {
    id: "mut_revenant_blood",
    name: "Revenant Blood",
    category: "offensive",
    tier: 2,
    unlock: { type: "blueprint", blueprintId: "bp_mutation_revenant_blood" },
    incompatibleWith: ["mut_hematic_elixir"],
    effects: [{ type: "on_kill_heal_percent", value: 0.08 }]
  },
  {
    id: "mut_thorn_reflex",
    name: "Thorn Reflex",
    category: "offensive",
    tier: 2,
    unlock: { type: "echo", cost: 2 },
    effects: [{ type: "on_hit_reflect_percent", value: 0.25 }]
  }
];

const DEFENSIVE_MUTATIONS: MutationDef[] = [
  {
    id: "mut_emergency_aegis",
    name: "Emergency Aegis",
    category: "defensive",
    tier: 1,
    unlock: { type: "default" },
    incompatibleWith: ["mut_phase_skin", "mut_iron_nerves"],
    effects: [{ type: "once_per_floor_lethal_guard", invulnMs: 900 }]
  },
  {
    id: "mut_guarded_core",
    name: "Guarded Core",
    category: "defensive",
    tier: 2,
    unlock: { type: "blueprint", blueprintId: "bp_mutation_guarded_core" },
    incompatibleWith: ["mut_phase_skin", "mut_iron_nerves"],
    effects: [{ type: "once_per_floor_lethal_guard", invulnMs: 1500 }]
  },
  {
    id: "mut_phase_skin",
    name: "Phase Skin",
    category: "defensive",
    tier: 2,
    unlock: { type: "echo", cost: 2 },
    incompatibleWith: ["mut_emergency_aegis", "mut_guarded_core", "mut_iron_nerves"],
    effects: [{ type: "on_hit_invuln", chance: 0.18, durationMs: 950, cooldownMs: 8500 }]
  },
  {
    id: "mut_iron_nerves",
    name: "Iron Nerves",
    category: "defensive",
    tier: 3,
    unlock: { type: "echo", cost: 4 },
    incompatibleWith: ["mut_emergency_aegis", "mut_guarded_core", "mut_phase_skin"],
    effects: [
      { type: "on_hit_invuln", chance: 0.24, durationMs: 1200, cooldownMs: 7000 },
      { type: "once_per_floor_lethal_guard", invulnMs: 1000 }
    ]
  }
];

const UTILITY_MUTATIONS: MutationDef[] = [
  {
    id: "mut_scavenger_mark",
    name: "Scavenger Mark",
    category: "utility",
    tier: 1,
    unlock: { type: "default" },
    effects: [{ type: "drop_bonus", soulShardPercent: 0.1, obolPercent: 0.12 }]
  },
  {
    id: "mut_void_exchange",
    name: "Void Exchange",
    category: "utility",
    tier: 2,
    unlock: { type: "blueprint", blueprintId: "bp_mutation_void_exchange" },
    effects: [{ type: "move_speed_multiplier", value: 1.12 }]
  },
  {
    id: "mut_hidden_cartography",
    name: "Hidden Cartography",
    category: "utility",
    tier: 2,
    unlock: { type: "blueprint", blueprintId: "bp_mutation_hidden_cartography" },
    effects: [{ type: "hidden_room_reveal_radius", value: 2.6 }]
  },
  {
    id: "mut_hematic_elixir",
    name: "Hematic Elixir",
    category: "utility",
    tier: 3,
    unlock: { type: "echo", cost: 3 },
    incompatibleWith: ["mut_revenant_blood"],
    effects: [{ type: "potion_heal_amp_and_self_damage", healPercent: 0.35, selfDamageCurrentHpPercent: 0.18 }]
  }
];

export const MUTATION_DEFS: MutationDef[] = [
  ...OFFENSIVE_MUTATIONS,
  ...DEFENSIVE_MUTATIONS,
  ...UTILITY_MUTATIONS
];

export const MUTATION_DEF_MAP = Object.fromEntries(MUTATION_DEFS.map((entry) => [entry.id, entry])) as Record<
  MutationDef["id"],
  MutationDef
>;

