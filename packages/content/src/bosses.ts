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

export const CATHEDRAL_JUDGE: BossDef = {
  id: "cathedral_judge",
  name: "Cathedral Judge",
  spriteKey: "boss_bone_sovereign",
  baseHealth: 920,
  phases: [
    {
      hpThreshold: 1,
      attackPattern: [
        {
          id: "gavel_bolt",
          cooldownMs: 3200,
          telegraphMs: 1100,
          type: "projectile",
          damage: 22,
          range: 7
        },
        {
          id: "verdict_seal",
          cooldownMs: 7600,
          telegraphMs: 1900,
          type: "aoe_zone",
          damage: 18,
          range: 6,
          radius: 1.6
        }
      ]
    },
    {
      hpThreshold: 0.55,
      attackPattern: [
        {
          id: "verdict_crush",
          cooldownMs: 2500,
          telegraphMs: 900,
          type: "melee",
          damage: 30,
          range: 1.6
        },
        {
          id: "gavel_bolt",
          cooldownMs: 2600,
          telegraphMs: 900,
          type: "projectile",
          damage: 24,
          range: 7
        },
        {
          id: "penitent_guard",
          cooldownMs: 12000,
          telegraphMs: 0,
          type: "summon",
          damage: 0,
          range: 0
        }
      ],
      enrageTimer: 110000
    }
  ],
  dropTableId: "boss_cathedral_judge_rare",
  exclusiveFloor: 5
};

export const EMBER_WARDEN: BossDef = {
  id: "ember_warden",
  name: "Ember Warden",
  spriteKey: "boss_bone_sovereign",
  baseHealth: 760,
  phases: [
    {
      hpThreshold: 1,
      attackPattern: [
        {
          id: "ember_cleave",
          cooldownMs: 2200,
          telegraphMs: 800,
          type: "melee",
          damage: 28,
          range: 1.7
        },
        {
          id: "cinder_lance",
          cooldownMs: 3800,
          telegraphMs: 900,
          type: "projectile",
          damage: 20,
          range: 7
        }
      ]
    },
    {
      hpThreshold: 0.5,
      attackPattern: [
        {
          id: "ember_cleave",
          cooldownMs: 1800,
          telegraphMs: 700,
          type: "melee",
          damage: 32,
          range: 1.8
        },
        {
          id: "slag_eruption",
          cooldownMs: 5200,
          telegraphMs: 1400,
          type: "aoe_zone",
          damage: 24,
          range: 7,
          radius: 2
        },
        {
          id: "cinder_lance",
          cooldownMs: 3000,
          telegraphMs: 700,
          type: "projectile",
          damage: 22,
          range: 7
        }
      ],
      enrageTimer: 95000
    }
  ],
  dropTableId: "boss_ember_warden_rare",
  exclusiveFloor: 5
};

export const OSSUARY_KEEPER: BossDef = {
  id: "ossuary_keeper",
  name: "Ossuary Keeper",
  spriteKey: "boss_bone_sovereign",
  baseHealth: 840,
  phases: [
    {
      hpThreshold: 1,
      attackPattern: [
        {
          id: "grave_shard",
          cooldownMs: 2800,
          telegraphMs: 1000,
          type: "projectile",
          damage: 19,
          range: 7
        },
        {
          id: "bone_relay",
          cooldownMs: 11000,
          telegraphMs: 0,
          type: "summon",
          damage: 0,
          range: 0
        }
      ]
    },
    {
      hpThreshold: 0.55,
      attackPattern: [
        {
          id: "grave_shard",
          cooldownMs: 2200,
          telegraphMs: 800,
          type: "projectile",
          damage: 22,
          range: 7
        },
        {
          id: "grave_lattice",
          cooldownMs: 6200,
          telegraphMs: 1700,
          type: "aoe_zone",
          damage: 17,
          range: 6,
          radius: 2.3
        },
        {
          id: "bone_relay",
          cooldownMs: 9000,
          telegraphMs: 0,
          type: "summon",
          damage: 0,
          range: 0
        }
      ],
      enrageTimer: 105000
    }
  ],
  dropTableId: "boss_ossuary_keeper_rare",
  exclusiveFloor: 5
};

export const BOSS_DEFS: BossDef[] = [BONE_SOVEREIGN, CATHEDRAL_JUDGE, EMBER_WARDEN, OSSUARY_KEEPER];

export const BOSS_DEF_MAP = Object.fromEntries(BOSS_DEFS.map((entry) => [entry.id, entry])) as Record<
  BossDef["id"],
  BossDef
>;
