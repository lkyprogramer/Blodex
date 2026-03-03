import type { MonsterArchetypeDef } from "./types";

export const MONSTER_ARCHETYPES: MonsterArchetypeDef[] = [
  {
    id: "melee_grunt",
    name: "Crypt Hound",
    healthMultiplier: 1,
    damageMultiplier: 0.9,
    attackRange: 1,
    moveSpeed: 110,
    xpValue: 18,
    spriteId: "monster_melee_01",
    dropTableId: "starter_floor",
    aiConfig: {
      behavior: "chase",
      chaseRange: 7,
      attackCooldownMs: 1800
    }
  },
  {
    id: "ranged_caster",
    name: "Ash Acolyte",
    healthMultiplier: 0.75,
    damageMultiplier: 1.05,
    attackRange: 5,
    moveSpeed: 95,
    xpValue: 22,
    spriteId: "monster_ranged_01",
    dropTableId: "cathedral_depths",
    aiConfig: {
      behavior: "kite",
      chaseRange: 7,
      attackCooldownMs: 1800,
      preferredDistance: 4.2
    }
  },
  {
    id: "elite_bruiser",
    name: "Iron Revenant",
    healthMultiplier: 1.7,
    damageMultiplier: 1.15,
    attackRange: 1,
    moveSpeed: 85,
    xpValue: 40,
    spriteId: "monster_elite_01",
    dropTableId: "catacomb_elite",
    aiConfig: {
      behavior: "shield",
      chaseRange: 7,
      attackCooldownMs: 1800,
      shieldThreshold: 0.45
    }
  },
  {
    id: "magma_crawler",
    name: "Magma Crawler",
    healthMultiplier: 0.82,
    damageMultiplier: 0.86,
    attackRange: 1,
    moveSpeed: 124,
    xpValue: 20,
    spriteId: "monster_melee_01",
    dropTableId: "starter_floor",
    aiConfig: {
      behavior: "swarm",
      chaseRange: 8,
      attackCooldownMs: 1450,
      swarmRadius: 2.6
    }
  },
  {
    id: "ember_wraith",
    name: "Ember Wraith",
    healthMultiplier: 0.72,
    damageMultiplier: 1.08,
    attackRange: 5.2,
    moveSpeed: 114,
    xpValue: 28,
    spriteId: "monster_ranged_01",
    dropTableId: "cathedral_depths",
    aiConfig: {
      behavior: "kite",
      chaseRange: 9,
      attackCooldownMs: 1600,
      preferredDistance: 4.8
    }
  },
  {
    id: "flame_brute",
    name: "Flame Brute",
    healthMultiplier: 1.42,
    damageMultiplier: 1.22,
    attackRange: 1.1,
    moveSpeed: 92,
    xpValue: 36,
    spriteId: "monster_elite_01",
    dropTableId: "catacomb_elite",
    aiConfig: {
      behavior: "chase",
      chaseRange: 7.2,
      attackCooldownMs: 1950
    }
  },
  {
    id: "frost_warden",
    name: "Frost Warden",
    healthMultiplier: 1.28,
    damageMultiplier: 0.96,
    attackRange: 1.2,
    moveSpeed: 86,
    xpValue: 34,
    spriteId: "monster_elite_01",
    dropTableId: "catacomb_elite",
    aiConfig: {
      behavior: "shield",
      chaseRange: 7,
      attackCooldownMs: 1700,
      shieldThreshold: 0.4
    }
  },
  {
    id: "ice_specter",
    name: "Ice Specter",
    healthMultiplier: 0.78,
    damageMultiplier: 1.02,
    attackRange: 5,
    moveSpeed: 112,
    xpValue: 30,
    spriteId: "monster_ranged_01",
    dropTableId: "cathedral_depths",
    aiConfig: {
      behavior: "kite",
      chaseRange: 8.5,
      attackCooldownMs: 1550,
      preferredDistance: 4.6
    }
  },
  {
    id: "shadow_lurker",
    name: "Shadow Lurker",
    healthMultiplier: 0.92,
    damageMultiplier: 1.18,
    attackRange: 1.1,
    moveSpeed: 118,
    xpValue: 29,
    spriteId: "monster_melee_01",
    dropTableId: "starter_floor",
    aiConfig: {
      behavior: "ambush",
      chaseRange: 8.4,
      attackCooldownMs: 1650,
      ambushRadius: 3.2
    }
  },
  {
    id: "bone_priest",
    name: "Bone Priest",
    healthMultiplier: 0.98,
    damageMultiplier: 0.82,
    attackRange: 3.4,
    moveSpeed: 90,
    xpValue: 33,
    spriteId: "monster_ranged_01",
    dropTableId: "cathedral_depths",
    aiConfig: {
      behavior: "support",
      chaseRange: 7,
      attackCooldownMs: 2100,
      supportRange: 4.8,
      healThreshold: 0.65,
      healPower: 24
    }
  },
  {
    id: "wraith_knight",
    name: "Wraith Knight",
    healthMultiplier: 1.36,
    damageMultiplier: 1.08,
    attackRange: 1.3,
    moveSpeed: 96,
    xpValue: 42,
    spriteId: "monster_elite_01",
    dropTableId: "catacomb_elite",
    aiConfig: {
      behavior: "shield",
      chaseRange: 8,
      attackCooldownMs: 1800,
      shieldThreshold: 0.35
    }
  },
  {
    id: "soul_eater",
    name: "Soul Eater",
    healthMultiplier: 0.88,
    damageMultiplier: 1.25,
    attackRange: 1.25,
    moveSpeed: 126,
    xpValue: 40,
    spriteId: "monster_melee_01",
    dropTableId: "starter_floor",
    aiConfig: {
      behavior: "ambush",
      chaseRange: 8.8,
      attackCooldownMs: 1500,
      ambushRadius: 3.8
    }
  },
  {
    id: "venom_spitter",
    name: "Venom Spitter",
    healthMultiplier: 0.84,
    damageMultiplier: 1.14,
    attackRange: 5.5,
    moveSpeed: 108,
    xpValue: 38,
    spriteId: "monster_ranged_01",
    dropTableId: "cathedral_depths",
    aiConfig: {
      behavior: "kite",
      chaseRange: 9.2,
      attackCooldownMs: 1500,
      preferredDistance: 5.1
    }
  },
  {
    id: "swamp_hulk",
    name: "Swamp Hulk",
    healthMultiplier: 1.8,
    damageMultiplier: 1.16,
    attackRange: 1.3,
    moveSpeed: 80,
    xpValue: 46,
    spriteId: "monster_elite_01",
    dropTableId: "catacomb_elite",
    aiConfig: {
      behavior: "chase",
      chaseRange: 7.4,
      attackCooldownMs: 2100
    }
  },
  {
    id: "fungal_host",
    name: "Fungal Host",
    healthMultiplier: 1.02,
    damageMultiplier: 0.92,
    attackRange: 3.8,
    moveSpeed: 94,
    xpValue: 39,
    spriteId: "monster_ranged_01",
    dropTableId: "cathedral_depths",
    aiConfig: {
      behavior: "support",
      chaseRange: 7.8,
      attackCooldownMs: 1850,
      supportRange: 5.2,
      healThreshold: 0.7,
      healPower: 28
    }
  }
];

export const MONSTER_ARCHETYPE_MAP: Record<MonsterArchetypeDef["id"], MonsterArchetypeDef> =
  Object.fromEntries(MONSTER_ARCHETYPES.map((entry) => [entry.id, entry])) as Record<
    MonsterArchetypeDef["id"],
    MonsterArchetypeDef
  >;
