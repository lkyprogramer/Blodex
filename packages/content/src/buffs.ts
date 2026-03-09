import type { BuffDef } from "./types";

export const BUFF_DEFS: BuffDef[] = [
  {
    id: "war_cry",
    name: "War Cry",
    duration: 6000,
    statModifiers: {
      attackPower: 12
    },
    statMultipliers: {
      attackSpeed: 1.2
    }
  },
  {
    id: "guaranteed_crit",
    name: "Guaranteed Crit",
    duration: 3000,
    guaranteedCrit: true
  },
  {
    id: "frost_slow",
    name: "Frost Slow",
    duration: 3000,
    slow: 0.5
  },
  {
    id: "frenzy_tonic",
    name: "Frenzy Tonic",
    duration: 8000,
    statModifiers: {
      attackPower: 10
    },
    statMultipliers: {
      attackSpeed: 1.15
    }
  },
  {
    id: "phantom_brew",
    name: "Phantom Brew",
    duration: 6000,
    statModifiers: {
      moveSpeed: 18,
      critChance: 0.08
    }
  }
];

export const BUFF_DEF_MAP = Object.fromEntries(BUFF_DEFS.map((entry) => [entry.id, entry])) as Record<
  BuffDef["id"],
  BuffDef
>;
