import type { HazardDef } from "./types";

export const HAZARD_DEFS: HazardDef[] = [
  {
    id: "lava_pool",
    type: "damage_zone",
    damagePerTick: 12,
    tickIntervalMs: 700,
    radiusTiles: 1.05,
    spriteKey: "telegraph_circle_red"
  },
  {
    id: "ice_patch",
    type: "movement_modifier",
    movementMultiplier: 0.62,
    radiusTiles: 1.1,
    spriteKey: "telegraph_circle_red"
  },
  {
    id: "bone_spike",
    type: "periodic_trap",
    damagePerTick: 24,
    triggerIntervalMs: 2600,
    telegraphMs: 650,
    radiusTiles: 0.85,
    spriteKey: "telegraph_circle_red"
  }
];

export const HAZARD_MAP: Record<string, HazardDef> = Object.fromEntries(
  HAZARD_DEFS.map((hazard) => [hazard.id, hazard])
);

