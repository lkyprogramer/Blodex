import type { ItemSetDef } from "./types";

export const ITEM_SET_DEFS: ItemSetDef[] = [
  {
    id: "ember_vow",
    name: "Ember Vow",
    theme: "offense",
    associatedDamageType: "fire",
    itemIds: ["emberbrand_edge", "cindersigil_band", "ashwake_treads"],
    bonuses: [
      {
        pieces: 2,
        derivedFlat: {
          attackPower: 6,
          moveSpeed: 6
        }
      },
      {
        pieces: 3,
        derivedFlat: {
          attackSpeed: 0.05,
          critChance: 0.04
        }
      }
    ]
  },
  {
    id: "judicator_regalia",
    name: "Judicator Regalia",
    theme: "defense",
    associatedDamageType: "lightning",
    itemIds: ["judicator_crown", "edict_plate", "absolver_seal"],
    bonuses: [
      {
        pieces: 2,
        derivedFlat: {
          armor: 6,
          maxMana: 12
        }
      },
      {
        pieces: 3,
        derivedFlat: {
          maxHealth: 18,
          critChance: 0.02
        }
      }
    ]
  },
  {
    id: "gravewake_relics",
    name: "Gravewake Relics",
    theme: "utility",
    associatedDamageType: "arcane",
    itemIds: ["gravewake_greaves", "ossuary_signet", "keeper_veil"],
    bonuses: [
      {
        pieces: 2,
        derivedFlat: {
          moveSpeed: 10,
          maxMana: 12
        }
      },
      {
        pieces: 3,
        derivedFlat: {
          attackPower: 5,
          critChance: 0.03
        }
      }
    ]
  }
];

export const ITEM_SET_DEF_MAP = Object.fromEntries(ITEM_SET_DEFS.map((entry) => [entry.id, entry])) as Record<
  ItemSetDef["id"],
  ItemSetDef
>;
