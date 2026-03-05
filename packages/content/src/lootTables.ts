import type { LootTableDef } from "./types";

export const LOOT_TABLES: LootTableDef[] = [
  {
    id: "starter_floor",
    entries: [
      { itemDefId: "rusted_sabre", weight: 16, minFloor: 1 },
      { itemDefId: "pilgrim_mace", weight: 14, minFloor: 1 },
      { itemDefId: "grim_helm", weight: 14, minFloor: 1 },
      { itemDefId: "chapel_cowl", weight: 12, minFloor: 1 },
      { itemDefId: "patchwork_hauberk", weight: 12, minFloor: 1 },
      { itemDefId: "wanderer_boots", weight: 12, minFloor: 1 },
      { itemDefId: "iron_vow_loop", weight: 10, minFloor: 1 },
      { itemDefId: "oath_ring", weight: 10, minFloor: 2 }
    ]
  },
  {
    id: "cathedral_depths",
    entries: [
      { itemDefId: "dusk_halberd", weight: 14, minFloor: 2 },
      { itemDefId: "penitent_blade", weight: 12, minFloor: 2 },
      { itemDefId: "warden_greathelm", weight: 12, minFloor: 2 },
      { itemDefId: "cathedral_plate", weight: 12, minFloor: 2 },
      { itemDefId: "pilgrim_treads", weight: 12, minFloor: 2 },
      { itemDefId: "oath_ring", weight: 12, minFloor: 2 },
      { itemDefId: "revenant_mask", weight: 8, minFloor: 4 },
      { itemDefId: "oathbound_cuirass", weight: 8, minFloor: 4 },
      { itemDefId: "bloodsigil_band", weight: 10, minFloor: 4 }
    ]
  },
  {
    id: "catacomb_elite",
    entries: [
      { itemDefId: "sanctified_greatsword", weight: 12, minFloor: 4 },
      { itemDefId: "revenant_mask", weight: 14, minFloor: 3 },
      { itemDefId: "oathbound_cuirass", weight: 14, minFloor: 3 },
      { itemDefId: "catacomb_greaves", weight: 14, minFloor: 3 },
      { itemDefId: "bloodsigil_band", weight: 16, minFloor: 3 },
      { itemDefId: "cathedral_plate", weight: 10, minFloor: 2 },
      { itemDefId: "dusk_halberd", weight: 10, minFloor: 2 },
      { itemDefId: "oath_ring", weight: 10, minFloor: 2 }
    ]
  },
  {
    id: "boss_bone_sovereign_rare",
    entries: [
      { itemDefId: "sanctified_greatsword", weight: 15, minFloor: 5 },
      { itemDefId: "revenant_mask", weight: 15, minFloor: 5 },
      { itemDefId: "oathbound_cuirass", weight: 15, minFloor: 5 },
      { itemDefId: "bloodsigil_band", weight: 15, minFloor: 5 },
      { itemDefId: "catacomb_greaves", weight: 15, minFloor: 5 }
    ]
  },
  {
    id: "boss_bone_sovereign_exclusive",
    entries: [
      { itemDefId: "sovereign_requiem", weight: 20, minFloor: 5 },
      { itemDefId: "crown_of_bone", weight: 20, minFloor: 5 },
      { itemDefId: "cataclysm_mail", weight: 20, minFloor: 5 },
      { itemDefId: "echostep_greaves", weight: 20, minFloor: 5 },
      { itemDefId: "voidsigil_band", weight: 20, minFloor: 5 }
    ]
  },
  {
    id: "merchant_pool",
    entries: [
      { itemDefId: "rusted_sabre", weight: 8, minFloor: 1 },
      { itemDefId: "grim_helm", weight: 8, minFloor: 1 },
      { itemDefId: "patchwork_hauberk", weight: 8, minFloor: 1 },
      { itemDefId: "wanderer_boots", weight: 8, minFloor: 1 },
      { itemDefId: "iron_vow_loop", weight: 8, minFloor: 1 },
      { itemDefId: "dusk_halberd", weight: 12, minFloor: 2 },
      { itemDefId: "penitent_blade", weight: 10, minFloor: 2 },
      { itemDefId: "warden_greathelm", weight: 10, minFloor: 2 },
      { itemDefId: "cathedral_plate", weight: 10, minFloor: 2 },
      { itemDefId: "pilgrim_treads", weight: 10, minFloor: 2 },
      { itemDefId: "oath_ring", weight: 10, minFloor: 2 },
      { itemDefId: "revenant_mask", weight: 8, minFloor: 3 },
      { itemDefId: "oathbound_cuirass", weight: 8, minFloor: 3 },
      { itemDefId: "bloodsigil_band", weight: 8, minFloor: 3 },
      { itemDefId: "sovereign_requiem", weight: 3, minFloor: 5 },
      { itemDefId: "crown_of_bone", weight: 3, minFloor: 5 },
      { itemDefId: "cataclysm_mail", weight: 3, minFloor: 5 },
      { itemDefId: "echostep_greaves", weight: 3, minFloor: 5 },
      { itemDefId: "voidsigil_band", weight: 3, minFloor: 5 }
    ]
  }
];

export const LOOT_TABLE_MAP = Object.fromEntries(LOOT_TABLES.map((table) => [table.id, table])) as Record<
  LootTableDef["id"],
  LootTableDef
>;
