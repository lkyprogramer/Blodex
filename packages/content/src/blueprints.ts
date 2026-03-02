import type { BlueprintDef } from "./types";

const SKILL_BLUEPRINTS: BlueprintDef[] = [
  {
    id: "bp_skill_frost_nova",
    name: "Frozen Sigil Draft",
    category: "skill",
    unlockTargetId: "frost_nova",
    forgeCost: 18,
    rarity: "common",
    dropSources: [{ type: "floor_clear", chance: 0.08, floorMin: 1 }]
  },
  {
    id: "bp_skill_war_cry",
    name: "War Cry Etching",
    category: "skill",
    unlockTargetId: "war_cry",
    forgeCost: 22,
    rarity: "common",
    dropSources: [{ type: "random_event", sourceId: "mysterious_shrine", chance: 0.2, floorMin: 1 }]
  },
  {
    id: "bp_skill_chain_lightning",
    name: "Storm Lattice",
    category: "skill",
    unlockTargetId: "chain_lightning",
    forgeCost: 28,
    rarity: "rare",
    dropSources: [{ type: "boss_kill", chance: 0.24, floorMin: 3 }]
  },
  {
    id: "bp_skill_spirit_burst",
    name: "Spirit Burst Matrix",
    category: "skill",
    unlockTargetId: "spirit_burst",
    forgeCost: 32,
    rarity: "rare",
    dropSources: [{ type: "challenge_room", chance: 0.35, floorMin: 2 }]
  },
  {
    id: "bp_skill_rift_step",
    name: "Rift Step Glyph",
    category: "skill",
    unlockTargetId: "rift_step",
    forgeCost: 45,
    rarity: "legendary",
    dropSources: [{ type: "boss_first_kill", sourceId: "bone_sovereign", chance: 1, floorMin: 5, onlyIfNotFound: true }]
  }
];

const WEAPON_BLUEPRINTS: BlueprintDef[] = [
  {
    id: "bp_weapon_axe",
    name: "Axe Frame",
    category: "weapon",
    unlockTargetId: "weapon_type_axe",
    forgeCost: 16,
    rarity: "common",
    dropSources: [{ type: "floor_clear", chance: 0.1, floorMin: 1 }]
  },
  {
    id: "bp_weapon_dagger",
    name: "Dagger Pattern",
    category: "weapon",
    unlockTargetId: "weapon_type_dagger",
    forgeCost: 16,
    rarity: "common",
    dropSources: [{ type: "monster_affix", sourceId: "frenzied", chance: 0.14, floorMin: 1 }]
  },
  {
    id: "bp_weapon_staff",
    name: "Arcstaff Scaffold",
    category: "weapon",
    unlockTargetId: "weapon_type_staff",
    forgeCost: 24,
    rarity: "rare",
    dropSources: [{ type: "random_event", sourceId: "unstable_portal", chance: 0.28, floorMin: 3 }]
  },
  {
    id: "bp_weapon_hammer",
    name: "Hammer Blueprint",
    category: "weapon",
    unlockTargetId: "weapon_type_hammer",
    forgeCost: 24,
    rarity: "rare",
    dropSources: [{ type: "monster_affix", sourceId: "armored", chance: 0.18, floorMin: 2 }]
  },
  {
    id: "bp_weapon_sword_master",
    name: "Swordmaster Lattice",
    category: "weapon",
    unlockTargetId: "weapon_type_sword_master",
    forgeCost: 40,
    rarity: "legendary",
    dropSources: [{ type: "boss_kill", sourceId: "bone_sovereign", chance: 0.3, floorMin: 5 }]
  }
];

const CONSUMABLE_BLUEPRINTS: BlueprintDef[] = [
  {
    id: "bp_consumable_mapping_plus",
    name: "Cartographer Ink",
    category: "consumable",
    unlockTargetId: "scroll_of_mapping_plus",
    forgeCost: 12,
    rarity: "common",
    dropSources: [{ type: "hidden_room", chance: 0.4, floorMin: 1 }]
  },
  {
    id: "bp_consumable_frenzy_tonic",
    name: "Frenzy Tonic Formula",
    category: "consumable",
    unlockTargetId: "frenzy_tonic",
    forgeCost: 20,
    rarity: "rare",
    dropSources: [{ type: "challenge_room", chance: 0.24, floorMin: 2 }]
  },
  {
    id: "bp_consumable_phantom_brew",
    name: "Phantom Brew Recipe",
    category: "consumable",
    unlockTargetId: "phantom_brew",
    forgeCost: 34,
    rarity: "legendary",
    dropSources: [{ type: "boss_first_kill", sourceId: "bone_sovereign", chance: 1, floorMin: 5, onlyIfNotFound: true }]
  }
];

const MUTATION_BLUEPRINTS: BlueprintDef[] = [
  {
    id: "bp_mutation_berserk_echo",
    name: "Berserk Echo Sigil",
    category: "mutation",
    unlockTargetId: "mut_berserk_echo",
    forgeCost: 14,
    rarity: "common",
    dropSources: [{ type: "monster_affix", sourceId: "frenzied", chance: 0.2, floorMin: 1 }]
  },
  {
    id: "bp_mutation_guarded_core",
    name: "Guarded Core Matrix",
    category: "mutation",
    unlockTargetId: "mut_guarded_core",
    forgeCost: 14,
    rarity: "common",
    dropSources: [{ type: "monster_affix", sourceId: "armored", chance: 0.2, floorMin: 1 }]
  },
  {
    id: "bp_mutation_void_exchange",
    name: "Void Exchange Cipher",
    category: "mutation",
    unlockTargetId: "mut_void_exchange",
    forgeCost: 24,
    rarity: "rare",
    dropSources: [{ type: "random_event", sourceId: "unstable_portal", chance: 0.25, floorMin: 3 }]
  },
  {
    id: "bp_mutation_revenant_blood",
    name: "Revenant Blood Script",
    category: "mutation",
    unlockTargetId: "mut_revenant_blood",
    forgeCost: 24,
    rarity: "rare",
    dropSources: [{ type: "boss_kill", chance: 0.2, floorMin: 3 }]
  },
  {
    id: "bp_mutation_hidden_cartography",
    name: "Hidden Cartography Rune",
    category: "mutation",
    unlockTargetId: "mut_hidden_cartography",
    forgeCost: 36,
    rarity: "legendary",
    dropSources: [{ type: "hidden_room", chance: 0.35, floorMin: 2 }]
  }
];

const EVENT_BLUEPRINTS: BlueprintDef[] = [
  {
    id: "bp_event_merchant_plus",
    name: "Merchant Ledger",
    category: "event",
    unlockTargetId: "wandering_merchant_plus",
    forgeCost: 18,
    rarity: "common",
    dropSources: [{ type: "random_event", sourceId: "wandering_merchant", chance: 0.25, floorMin: 1 }]
  },
  {
    id: "bp_event_ritual_chamber",
    name: "Ritual Chamber Plan",
    category: "event",
    unlockTargetId: "ritual_chamber",
    forgeCost: 34,
    rarity: "legendary",
    dropSources: [{ type: "boss_kill", sourceId: "bone_sovereign", chance: 0.22, floorMin: 5 }]
  }
];

export const BLUEPRINT_DEFS: BlueprintDef[] = [
  ...SKILL_BLUEPRINTS,
  ...WEAPON_BLUEPRINTS,
  ...CONSUMABLE_BLUEPRINTS,
  ...MUTATION_BLUEPRINTS,
  ...EVENT_BLUEPRINTS
];

export const BLUEPRINT_DEF_MAP = Object.fromEntries(
  BLUEPRINT_DEFS.map((entry) => [entry.id, entry])
);
