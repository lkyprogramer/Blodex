import type { WeaponTypeDef } from "./types";

export const WEAPON_TYPE_DEFS: WeaponTypeDef[] = [
  {
    id: "sword",
    attackSpeedMultiplier: 1,
    attackRange: 1.5,
    damageMultiplier: 1,
    mechanic: { type: "none" },
    unlock: { type: "default" }
  },
  {
    id: "axe",
    attackSpeedMultiplier: 0.9,
    attackRange: 1.65,
    damageMultiplier: 1.12,
    mechanic: { type: "aoe_cleave", radius: 1.35, secondaryDamagePercent: 0.34 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_axe" }
  },
  {
    id: "dagger",
    attackSpeedMultiplier: 1.22,
    attackRange: 1.35,
    damageMultiplier: 0.86,
    mechanic: { type: "crit_bonus", critChanceBonus: 0.1, critDamageMultiplier: 1.95 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_dagger" }
  },
  {
    id: "staff",
    attackSpeedMultiplier: 0.95,
    attackRange: 1.75,
    damageMultiplier: 0.94,
    mechanic: { type: "skill_amp", skillDamagePercent: 0.2 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_staff" }
  },
  {
    id: "hammer",
    attackSpeedMultiplier: 0.82,
    attackRange: 1.45,
    damageMultiplier: 1.2,
    mechanic: { type: "stagger", chance: 0.2, slowPercent: 0.3, durationMs: 1200 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_hammer" }
  }
];

export const WEAPON_TYPE_DEF_MAP = Object.fromEntries(
  WEAPON_TYPE_DEFS.map((entry) => [entry.id, entry])
) as Record<WeaponTypeDef["id"], WeaponTypeDef>;

