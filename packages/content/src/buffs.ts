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
  }
];

export const BUFF_DEF_MAP = Object.fromEntries(BUFF_DEFS.map((entry) => [entry.id, entry])) as Record<
  BuffDef["id"],
  BuffDef
>;
