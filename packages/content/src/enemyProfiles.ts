import type { EnemyProfileDef } from "./types";

export const ENEMY_PROFILES: EnemyProfileDef[] = [
  {
    id: "grave_flesh",
    name: "Grave Flesh",
    damageProfile: {
      fire: 1.06,
      cold: 0.94
    }
  },
  {
    id: "emberborn",
    name: "Emberborn",
    damageProfile: {
      fire: 0.72,
      cold: 1.18,
      lightning: 1.04
    }
  },
  {
    id: "frostbound",
    name: "Frostbound",
    damageProfile: {
      fire: 1.2,
      cold: 0.72,
      lightning: 0.96
    }
  },
  {
    id: "arcane_ward",
    name: "Arcane Ward",
    damageProfile: {
      arcane: 0.78,
      lightning: 1.08,
      physical: 1.04
    }
  },
  {
    id: "storm_forged",
    name: "Storm Forged",
    damageProfile: {
      lightning: 0.76,
      physical: 1.08,
      fire: 0.94
    }
  },
  {
    id: "swamp_rot",
    name: "Swamp Rot",
    damageProfile: {
      lightning: 1.14,
      fire: 0.92,
      cold: 0.97
    }
  }
];

export const ENEMY_PROFILE_MAP = Object.fromEntries(ENEMY_PROFILES.map((entry) => [entry.id, entry])) as Record<
  EnemyProfileDef["id"],
  EnemyProfileDef
>;
