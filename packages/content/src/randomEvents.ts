import type { RandomEventDef } from "./types";

export const RANDOM_EVENT_DEFS: RandomEventDef[] = [
  {
    id: "mysterious_shrine",
    name: "Mysterious Shrine",
    description: "A pulsing shrine asks for tribute.",
    floorRange: { min: 1, max: 5 },
    spawnWeight: 18,
    choices: [
      {
        id: "offer_obol",
        name: "Offer Obol",
        description: "Spend 8 Obol for a blessing.",
        cost: { type: "obol", amount: 8 },
        rewards: [{ type: "health", amount: 30 }, { type: "mana", amount: 20 }]
      },
      {
        id: "touch_relic",
        name: "Touch Relic",
        description: "Gain reward but risk curse.",
        rewards: [{ type: "obol", amount: 10 }],
        risk: {
          chance: 0.35,
          penalty: { type: "health", amount: 18 }
        }
      },
      {
        id: "leave",
        name: "Leave",
        description: "Walk away quietly.",
        rewards: []
      }
    ]
  },
  {
    id: "trapped_chest",
    name: "Trapped Chest",
    description: "An ornate chest hums with pressure runes.",
    floorRange: { min: 2, max: 5 },
    spawnWeight: 16,
    choices: [
      {
        id: "force_open",
        name: "Force Open",
        description: "Open for loot, risk damage.",
        rewards: [{ type: "item", lootTableId: "cathedral_depths" }],
        risk: {
          chance: 0.45,
          penalty: { type: "health", amount: 22 }
        }
      },
      {
        id: "disarm",
        name: "Disarm",
        description: "Spend mana for safer opening.",
        cost: { type: "mana", amount: 18 },
        rewards: [{ type: "item", lootTableId: "cathedral_depths" }]
      },
      {
        id: "ignore",
        name: "Ignore",
        description: "No reward, no risk.",
        rewards: []
      }
    ]
  },
  {
    id: "wandering_merchant",
    name: "Wandering Merchant",
    description: "A cloaked trader offers relics for Obol.",
    floorRange: { min: 2, max: 5 },
    spawnWeight: 14,
    unlockId: "wandering_merchant",
    choices: [
      {
        id: "browse",
        name: "Browse Wares",
        description: "See available offers.",
        rewards: []
      },
      {
        id: "leave",
        name: "Leave",
        description: "Not now.",
        rewards: []
      }
    ]
  },
  {
    id: "cursed_altar",
    name: "Cursed Altar",
    description: "Blood sigils promise strength for pain.",
    floorRange: { min: 3, max: 5 },
    spawnWeight: 12,
    choices: [
      {
        id: "blood_trade",
        name: "Blood Trade",
        description: "Lose health for a rare reward.",
        cost: { type: "health", amount: 25 },
        rewards: [{ type: "item", lootTableId: "catacomb_elite" }]
      },
      {
        id: "drain_mana",
        name: "Arcane Trade",
        description: "Spend mana for Obol gain.",
        cost: { type: "mana", amount: 26 },
        rewards: [{ type: "obol", amount: 14 }]
      },
      {
        id: "reject",
        name: "Reject",
        description: "Do nothing.",
        rewards: []
      }
    ]
  },
  {
    id: "fallen_adventurer",
    name: "Fallen Adventurer",
    description: "A dying warrior offers their last stash.",
    floorRange: { min: 1, max: 5 },
    spawnWeight: 15,
    choices: [
      {
        id: "aid",
        name: "Aid",
        description: "Spend mana and gain supplies.",
        cost: { type: "mana", amount: 12 },
        rewards: [
          { type: "consumable", consumableId: "health_potion", amount: 1 },
          { type: "consumable", consumableId: "mana_potion", amount: 1 }
        ]
      },
      {
        id: "loot",
        name: "Loot",
        description: "Take the stash with moral risk.",
        rewards: [{ type: "obol", amount: 12 }, { type: "item", lootTableId: "starter_floor" }],
        risk: {
          chance: 0.3,
          penalty: { type: "health", amount: 15 }
        }
      }
    ]
  },
  {
    id: "unstable_portal",
    name: "Unstable Portal",
    description: "A crackling rift twists local reality.",
    floorRange: { min: 3, max: 5 },
    biomeIds: ["molten_caverns", "frozen_halls", "bone_throne"],
    spawnWeight: 10,
    unlockId: "unstable_portal",
    choices: [
      {
        id: "attune",
        name: "Attune",
        description: "Gain insight and map reveal.",
        rewards: [{ type: "mapping" }, { type: "xp", amount: 48 }]
      },
      {
        id: "harvest",
        name: "Harvest",
        description: "Extract Obol but risk backlash.",
        rewards: [{ type: "obol", amount: 18 }],
        risk: {
          chance: 0.5,
          penalty: { type: "mana", amount: 24 }
        }
      },
      {
        id: "seal",
        name: "Seal",
        description: "Stabilize and leave.",
        rewards: []
      }
    ]
  },
  {
    id: "abyss_contract",
    name: "Abyss Contract",
    description: "An ink-black contract promises delayed profit at a steep premium.",
    floorRange: { min: 6, max: 30 },
    spawnWeight: 9,
    choices: [
      {
        id: "sign_heavy",
        name: "Sign Heavy Clause",
        description: "Pay Obol now for a large run-end payout.",
        cost: { type: "obol", amount: 14 },
        rewards: [
          {
            type: "deferred_outcome",
            source: "event",
            trigger: { type: "run_end" },
            reward: { obol: 38 }
          }
        ]
      },
      {
        id: "sign_safe",
        name: "Sign Safe Clause",
        description: "Small immediate gain with smaller delayed payout.",
        rewards: [
          { type: "obol", amount: 6 },
          {
            type: "deferred_outcome",
            source: "event",
            trigger: { type: "run_end" },
            reward: { obol: 14 }
          }
        ]
      },
      {
        id: "refuse",
        name: "Refuse",
        description: "Walk away and keep momentum.",
        rewards: []
      }
    ]
  },
  {
    id: "war_trophy_ledger",
    name: "War Trophy Ledger",
    description: "A quartermaster ledger offers boss-bounty claims in advance.",
    floorRange: { min: 7, max: 30 },
    spawnWeight: 8,
    choices: [
      {
        id: "claim_weapon",
        name: "Register Weapon Claim",
        description: "Receive a forged weapon if the next boss falls.",
        cost: { type: "obol", amount: 10 },
        rewards: [
          {
            type: "deferred_outcome",
            source: "event",
            trigger: { type: "boss_kill" },
            reward: { itemDefId: "item_weapon_03" }
          }
        ]
      },
      {
        id: "claim_essence",
        name: "Register Essence Claim",
        description: "Bank shard reward for run end instead.",
        rewards: [
          {
            type: "deferred_outcome",
            source: "event",
            trigger: { type: "run_end" },
            reward: { shard: 18 }
          }
        ]
      },
      {
        id: "ignore",
        name: "Ignore",
        description: "No claim this time.",
        rewards: []
      }
    ]
  },
  {
    id: "echo_loan",
    name: "Echo Loan",
    description: "A broker offers floor-indexed credit backed by future loot rights.",
    floorRange: { min: 8, max: 30 },
    spawnWeight: 7,
    choices: [
      {
        id: "take_floor_10_note",
        name: "Take Floor 10 Note",
        description: "Unlock payout once floor 10 is reached.",
        rewards: [
          {
            type: "deferred_outcome",
            source: "event",
            trigger: { type: "floor_reached", value: 10 },
            reward: { obol: 22 }
          }
        ]
      },
      {
        id: "take_floor_14_note",
        name: "Take Floor 14 Note",
        description: "Bigger delayed payout, but mana backlash risk.",
        rewards: [
          {
            type: "deferred_outcome",
            source: "event",
            trigger: { type: "floor_reached", value: 14 },
            reward: { obol: 34 }
          }
        ],
        risk: {
          chance: 0.4,
          penalty: { type: "mana", amount: 20 }
        }
      },
      {
        id: "decline",
        name: "Decline",
        description: "No debt, no upside.",
        rewards: []
      }
    ]
  }
];

export const RANDOM_EVENT_MAP: Record<RandomEventDef["id"], RandomEventDef> = Object.fromEntries(
  RANDOM_EVENT_DEFS.map((eventDef) => [eventDef.id, eventDef])
) as Record<RandomEventDef["id"], RandomEventDef>;
