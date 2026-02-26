import type { BossDef } from "./types";

export const BONE_SOVEREIGN: BossDef = {
  id: "bone_sovereign",
  name: "Bone Sovereign",
  spriteKey: "boss_bone_sovereign",
  baseHealth: 800,
  phases: [
    {
      hpThreshold: 1,
      attackPattern: [
        {
          id: "heavy_strike",
          cooldownMs: 3000,
          telegraphMs: 1500,
          type: "melee",
          damage: 25,
          range: 1.5
        },
        {
          id: "summon_hounds",
          cooldownMs: 15000,
          telegraphMs: 0,
          type: "summon",
          damage: 0,
          range: 0
        }
      ]
    },
    {
      hpThreshold: 0.5,
      attackPattern: [
        {
          id: "heavy_strike",
          cooldownMs: 2500,
          telegraphMs: 1200,
          type: "melee",
          damage: 30,
          range: 1.5
        },
        {
          id: "bone_spikes",
          cooldownMs: 6000,
          telegraphMs: 2000,
          type: "aoe_zone",
          damage: 20,
          range: 6,
          radius: 1.5
        },
        {
          id: "summon_hounds",
          cooldownMs: 10000,
          telegraphMs: 0,
          type: "summon",
          damage: 0,
          range: 0
        }
      ],
      enrageTimer: 120000
    }
  ],
  dropTableId: "boss_bone_sovereign_rare",
  exclusiveFloor: 5
};

export const BOSS_DEFS: BossDef[] = [BONE_SOVEREIGN];

export const BOSS_DEF_MAP = Object.fromEntries(BOSS_DEFS.map((entry) => [entry.id, entry])) as Record<
  BossDef["id"],
  BossDef
>;
