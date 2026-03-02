import type { ItemDef } from "./types";

export const ITEM_DEFS: ItemDef[] = [
  {
    id: "rusted_sabre",
    name: "Rusted Sabre",
    slot: "weapon",
    weaponType: "sword",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_weapon_01",
    minAffixes: 1,
    maxAffixes: 1,
    affixPool: [
      { key: "attackPower", min: 2, max: 5 },
      { key: "critChance", min: 0, max: 1 }
    ]
  },
  {
    id: "pilgrim_mace",
    name: "Pilgrim Mace",
    slot: "weapon",
    weaponType: "hammer",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_weapon_01",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "attackPower", min: 3, max: 6 },
      { key: "maxHealth", min: 3, max: 8 }
    ]
  },
  {
    id: "dusk_halberd",
    name: "Dusk Halberd",
    slot: "weapon",
    weaponType: "axe",
    rarity: "magic",
    requiredLevel: 2,
    iconId: "item_weapon_02",
    minAffixes: 2,
    maxAffixes: 2,
    affixPool: [
      { key: "attackPower", min: 5, max: 10 },
      { key: "critChance", min: 1, max: 2 },
      { key: "attackSpeed", min: 1, max: 3 }
    ]
  },
  {
    id: "penitent_blade",
    name: "Penitent Blade",
    slot: "weapon",
    weaponType: "dagger",
    rarity: "magic",
    requiredLevel: 2,
    iconId: "item_weapon_02",
    minAffixes: 2,
    maxAffixes: 3,
    affixPool: [
      { key: "attackPower", min: 4, max: 9 },
      { key: "maxMana", min: 4, max: 8 },
      { key: "critChance", min: 1, max: 2 }
    ]
  },
  {
    id: "sanctified_greatsword",
    name: "Sanctified Greatsword",
    slot: "weapon",
    weaponType: "sword",
    rarity: "rare",
    requiredLevel: 3,
    iconId: "item_weapon_03",
    minAffixes: 3,
    maxAffixes: 3,
    affixPool: [
      { key: "attackPower", min: 10, max: 16 },
      { key: "critChance", min: 2, max: 4 },
      { key: "attackSpeed", min: 2, max: 4 },
      { key: "maxHealth", min: 8, max: 14 }
    ],
    minSpecialAffixes: 1,
    maxSpecialAffixes: 2,
    specialAffixPool: [
      { key: "lifesteal", min: 2, max: 5 },
      { key: "critDamage", min: 8, max: 15 },
      { key: "aoeRadius", min: 6, max: 12 },
      { key: "damageOverTime", min: 4, max: 9 }
    ]
  },
  {
    id: "grim_helm",
    name: "Grim Helm",
    slot: "helm",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_helm_01",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "maxHealth", min: 4, max: 10 },
      { key: "armor", min: 1, max: 4 }
    ]
  },
  {
    id: "chapel_cowl",
    name: "Chapel Cowl",
    slot: "helm",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_helm_01",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "maxMana", min: 4, max: 9 },
      { key: "armor", min: 1, max: 3 }
    ]
  },
  {
    id: "warden_greathelm",
    name: "Warden Greathelm",
    slot: "helm",
    rarity: "magic",
    requiredLevel: 2,
    iconId: "item_helm_02",
    minAffixes: 2,
    maxAffixes: 2,
    affixPool: [
      { key: "armor", min: 3, max: 7 },
      { key: "maxHealth", min: 8, max: 16 },
      { key: "critChance", min: 1, max: 2 }
    ]
  },
  {
    id: "revenant_mask",
    name: "Revenant Mask",
    slot: "helm",
    rarity: "rare",
    requiredLevel: 3,
    iconId: "item_helm_02",
    minAffixes: 2,
    maxAffixes: 3,
    affixPool: [
      { key: "armor", min: 5, max: 10 },
      { key: "maxHealth", min: 10, max: 20 },
      { key: "maxMana", min: 6, max: 12 }
    ],
    minSpecialAffixes: 1,
    maxSpecialAffixes: 2,
    specialAffixPool: [
      { key: "dodgeChance", min: 2, max: 6 },
      { key: "healthRegen", min: 2, max: 5 },
      { key: "cooldownReduction", min: 4, max: 9 }
    ]
  },
  {
    id: "patchwork_hauberk",
    name: "Patchwork Hauberk",
    slot: "chest",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_chest_01",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "armor", min: 2, max: 5 },
      { key: "maxHealth", min: 5, max: 11 }
    ]
  },
  {
    id: "cathedral_plate",
    name: "Cathedral Plate",
    slot: "chest",
    rarity: "magic",
    requiredLevel: 2,
    iconId: "item_chest_01",
    minAffixes: 2,
    maxAffixes: 3,
    affixPool: [
      { key: "maxHealth", min: 8, max: 20 },
      { key: "armor", min: 3, max: 8 },
      { key: "moveSpeed", min: 1, max: 3 }
    ]
  },
  {
    id: "oathbound_cuirass",
    name: "Oathbound Cuirass",
    slot: "chest",
    rarity: "rare",
    requiredLevel: 3,
    iconId: "item_chest_02",
    minAffixes: 3,
    maxAffixes: 3,
    affixPool: [
      { key: "armor", min: 7, max: 14 },
      { key: "maxHealth", min: 12, max: 24 },
      { key: "maxMana", min: 8, max: 14 },
      { key: "moveSpeed", min: 2, max: 4 }
    ],
    minSpecialAffixes: 1,
    maxSpecialAffixes: 2,
    specialAffixPool: [
      { key: "thorns", min: 3, max: 7 },
      { key: "healthRegen", min: 2, max: 5 },
      { key: "soulShardBonus", min: 5, max: 12 }
    ]
  },
  {
    id: "wanderer_boots",
    name: "Wanderer Boots",
    slot: "boots",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_boots_01",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "moveSpeed", min: 2, max: 6 },
      { key: "armor", min: 1, max: 4 }
    ]
  },
  {
    id: "pilgrim_treads",
    name: "Pilgrim Treads",
    slot: "boots",
    rarity: "magic",
    requiredLevel: 2,
    iconId: "item_boots_02",
    minAffixes: 2,
    maxAffixes: 2,
    affixPool: [
      { key: "moveSpeed", min: 4, max: 8 },
      { key: "maxHealth", min: 5, max: 10 },
      { key: "attackSpeed", min: 1, max: 2 }
    ]
  },
  {
    id: "catacomb_greaves",
    name: "Catacomb Greaves",
    slot: "boots",
    rarity: "rare",
    requiredLevel: 3,
    iconId: "item_boots_02",
    minAffixes: 2,
    maxAffixes: 3,
    affixPool: [
      { key: "moveSpeed", min: 5, max: 10 },
      { key: "armor", min: 3, max: 7 },
      { key: "maxHealth", min: 8, max: 14 }
    ],
    minSpecialAffixes: 1,
    maxSpecialAffixes: 2,
    specialAffixPool: [
      { key: "dodgeChance", min: 2, max: 5 },
      { key: "xpBonus", min: 6, max: 12 },
      { key: "cooldownReduction", min: 3, max: 8 }
    ]
  },
  {
    id: "iron_vow_loop",
    name: "Iron Vow Loop",
    slot: "ring",
    rarity: "common",
    requiredLevel: 1,
    iconId: "item_ring_01",
    minAffixes: 1,
    maxAffixes: 2,
    affixPool: [
      { key: "maxMana", min: 3, max: 7 },
      { key: "critChance", min: 1, max: 1 }
    ]
  },
  {
    id: "oath_ring",
    name: "Oath Ring",
    slot: "ring",
    rarity: "magic",
    requiredLevel: 2,
    iconId: "item_ring_01",
    minAffixes: 2,
    maxAffixes: 2,
    affixPool: [
      { key: "critChance", min: 1, max: 2 },
      { key: "attackPower", min: 2, max: 6 },
      { key: "maxMana", min: 4, max: 10 }
    ]
  },
  {
    id: "bloodsigil_band",
    name: "Bloodsigil Band",
    slot: "ring",
    rarity: "rare",
    requiredLevel: 3,
    iconId: "item_ring_02",
    minAffixes: 2,
    maxAffixes: 3,
    affixPool: [
      { key: "critChance", min: 2, max: 4 },
      { key: "attackPower", min: 5, max: 11 },
      { key: "maxHealth", min: 8, max: 16 }
    ],
    minSpecialAffixes: 1,
    maxSpecialAffixes: 2,
    specialAffixPool: [
      { key: "lifesteal", min: 2, max: 4 },
      { key: "critDamage", min: 10, max: 20 },
      { key: "cooldownReduction", min: 5, max: 10 }
    ]
  },
  {
    id: "sovereign_requiem",
    name: "Sovereign Requiem",
    kind: "unique",
    slot: "weapon",
    weaponType: "staff",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "item_weapon_03",
    minAffixes: 0,
    maxAffixes: 0,
    affixPool: [],
    fixedAffixes: {
      attackPower: 22,
      critChance: 4,
      attackSpeed: 4
    },
    fixedSpecialAffixes: {
      lifesteal: 6,
      critDamage: 22
    }
  },
  {
    id: "crown_of_bone",
    name: "Crown of Bone",
    kind: "unique",
    slot: "helm",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "item_helm_02",
    minAffixes: 0,
    maxAffixes: 0,
    affixPool: [],
    fixedAffixes: {
      armor: 11,
      maxHealth: 28
    },
    fixedSpecialAffixes: {
      healthRegen: 6,
      soulShardBonus: 15
    }
  },
  {
    id: "cataclysm_mail",
    name: "Cataclysm Mail",
    kind: "unique",
    slot: "chest",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "item_chest_02",
    minAffixes: 0,
    maxAffixes: 0,
    affixPool: [],
    fixedAffixes: {
      armor: 16,
      maxHealth: 32,
      maxMana: 18
    },
    fixedSpecialAffixes: {
      thorns: 9,
      cooldownReduction: 12
    }
  },
  {
    id: "echostep_greaves",
    name: "Echostep Greaves",
    kind: "unique",
    slot: "boots",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "item_boots_02",
    minAffixes: 0,
    maxAffixes: 0,
    affixPool: [],
    fixedAffixes: {
      moveSpeed: 16,
      maxHealth: 14
    },
    fixedSpecialAffixes: {
      dodgeChance: 9,
      xpBonus: 18
    }
  },
  {
    id: "voidsigil_band",
    name: "Voidsigil Band",
    kind: "unique",
    slot: "ring",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "item_ring_02",
    minAffixes: 0,
    maxAffixes: 0,
    affixPool: [],
    fixedAffixes: {
      attackPower: 12,
      critChance: 5,
      maxMana: 22
    },
    fixedSpecialAffixes: {
      cooldownReduction: 14,
      aoeRadius: 18
    }
  }
];

export const ITEM_DEF_MAP = Object.fromEntries(ITEM_DEFS.map((def) => [def.id, def]));
