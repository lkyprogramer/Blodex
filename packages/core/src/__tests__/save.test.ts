import { describe, expect, it } from "vitest";
import type {
  BossRuntimeState,
  DungeonLayout,
  HazardRuntimeState,
  MonsterState,
  PlayerState,
  RunRngStreamName
} from "../contracts/types";
import { createInitialConsumableState } from "../consumable";
import { getDifficultyModifier } from "../difficulty";
import type { RunState } from "../run";
import {
  deserializeRunState,
  deserializeRunStateResult,
  serializeRunState,
  validateSave,
  type RunSaveDataV3
} from "../save";
import { defaultBaseStats, deriveStats } from "../stats";

function makeRunState(): RunState {
  return {
    startedAtMs: 100,
    runSeed: "seed-1",
    difficulty: "normal",
    difficultyModifier: getDifficultyModifier("normal"),
    currentFloor: 2,
    currentBiomeId: "molten_caverns",
    floor: 2,
    floorsCleared: 1,
    kills: 3,
    totalKills: 7,
    lootCollected: 2,
    challengeSuccessCount: 1,
    inEndless: false,
    endlessFloor: 0,
    mutatorActiveIds: [],
    mutatorState: {},
    deferredShardBonus: 0,
    runMode: "normal",
    runEconomy: {
      obols: 9,
      spentObols: 1
    }
  };
}

function makePlayer(): PlayerState {
  const baseStats = defaultBaseStats();
  const derived = deriveStats(baseStats, []);
  return {
    id: "player",
    position: { x: 4, y: 5 },
    level: 2,
    xp: 20,
    xpToNextLevel: 80,
    pendingLevelUpChoices: 0,
    pendingSkillChoices: 1,
    health: derived.maxHealth,
    mana: derived.maxMana,
    baseStats,
    derivedStats: derived,
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: [null, null],
      cooldowns: {}
    },
    activeBuffs: []
  };
}

function makeDungeon(): DungeonLayout {
  return {
    width: 8,
    height: 8,
    walkable: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => true)),
    rooms: [],
    corridors: [],
    spawnPoints: [{ x: 1, y: 1 }],
    playerSpawn: { x: 1, y: 1 },
    hiddenRooms: [
      {
        roomId: "hidden-1",
        entrance: { x: 2, y: 2 },
        revealed: false,
        rewardsClaimed: false
      }
    ],
    layoutHash: "layout-1"
  };
}

function makeHazard(): HazardRuntimeState {
  return {
    id: "haz-1",
    defId: "fire_pool",
    type: "damage_zone",
    position: { x: 3, y: 3 },
    radiusTiles: 1.2,
    damagePerTick: 8,
    tickIntervalMs: 1000,
    movementMultiplier: undefined,
    triggerIntervalMs: undefined,
    telegraphMs: undefined,
    nextTickAtMs: 500,
    nextTriggerAtMs: undefined
  };
}

function makeMonsterState(): MonsterState {
  return {
    id: "m-1",
    archetypeId: "melee_grunt",
    level: 2,
    health: 40,
    maxHealth: 40,
    damage: 8,
    attackRange: 1.2,
    moveSpeed: 2.4,
    xpValue: 8,
    dropTableId: "basic",
    position: { x: 5, y: 5 },
    aiState: "chase"
  };
}

function makeBossState(): BossRuntimeState {
  return {
    bossId: "bone_sovereign",
    currentPhaseIndex: 1,
    health: 100,
    maxHealth: 240,
    attackCooldowns: {},
    position: { x: 6, y: 6 },
    aiState: "idle"
  };
}

function makeRngCursor(): Record<RunRngStreamName, number> {
  return {
    procgen: 3,
    spawn: 9,
    combat: 4,
    loot: 2,
    skill: 1,
    boss: 0,
    biome: 5,
    hazard: 7,
    event: 6,
    merchant: 8
  };
}

function makeSave(): RunSaveDataV3 {
  return {
    schemaVersion: 3,
    savedAtMs: 123,
    appVersion: "test",
    runId: "seed-1:100",
    runSeed: "seed-1",
    domain: {
      run: makeRunState(),
      player: {
        ...makePlayer(),
        activeBuffs: [
          {
            defId: "war_cry",
            sourceId: "player",
            targetId: "player",
            remainingMs: 700
          }
        ]
      },
      consumables: createInitialConsumableState(0),
      blueprintFoundIdsInRun: ["bp_1"],
      selectedMutationIds: ["mut_1"]
    },
    runtime: {
      dungeon: makeDungeon(),
      staircase: {
        kind: "single",
        position: { x: 7, y: 7 },
        visible: false
      },
      hazards: [makeHazard()],
      boss: makeBossState(),
      monsters: [
        {
          state: {
            ...makeMonsterState(),
            activeBuffs: [
              {
                defId: "frost_slow",
                sourceId: "player",
                targetId: "m-1",
                remainingMs: 500
              }
            ]
          },
          baseMoveSpeed: 3.2,
          nextAttackAt: 300,
          nextSupportAt: 0
        }
      ],
      lootOnGround: [
        {
          item: {
            id: "loot-1",
            defId: "item_weapon_01",
            name: "Rust Blade",
            slot: "weapon",
            rarity: "common",
            requiredLevel: 1,
            iconId: "item_weapon_01",
            seed: "loot-seed",
            rolledAffixes: {
              attackPower: 2
            }
          },
          position: { x: 2, y: 2 }
        }
      ],
      eventNode: {
        eventId: "wandering_merchant",
        position: { x: 4, y: 4 },
        resolved: false,
        merchantOffers: []
      },
      minimap: {
        layoutHash: "layout-1",
        exploredKeys: [1, 2, 3]
      },
      mapRevealActive: false,
      deferredOutcomes: [
        {
          outcomeId: "event-1",
          source: "event",
          trigger: {
            type: "floor_reached",
            value: 4
          },
          reward: {
            obol: 15
          },
          status: "pending"
        }
      ],
      floorChoiceBudget: {
        floor: 3,
        satisfied: true,
        source: "event"
      },
      powerSpikeBudgetState: {
        pairStates: {
          "1-2": { hitCount: 1, majorHitCount: 0, satisfied: true, fallbackGranted: false },
          "3-4": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false },
          "5": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false }
        },
        acceptedSpikeCount: 1,
        majorSpikeCount: 0
      },
      phase6TelemetryState: {
        startedAtMs: 100,
        buildFormedState: true,
        inputTimestampsMs: [120, 150, 190],
        story: {
          playerFacingChoices: 4,
          choiceCountByFloor: {
            "1": 1,
            "2": 2
          },
          powerSpikes: 2,
          majorPowerSpikes: 1,
          buildFormed: 1,
          rareDropsPresented: 1,
          bossRewardClosed: 0
        },
        combat: {
          skillUses: 7,
          skillCastsPer30s: 3.5,
          skillDamage: 120,
          autoAttackDamage: 180,
          skillDamageShare: 0.4,
          autoAttackDamageShare: 0.6,
          manaDryWindowMs: 800,
          averageNoInputGapMs: 950,
          maxNoInputGapMs: 2100
        },
        runtimeEffects: {
          buffApplyCountById: { war_cry: 2 },
          buffUptimeMsById: { war_cry: 6_000 },
          damageDealtByType: { physical: 180, arcane: 120 },
          damageTakenByType: { physical: 25 },
          resolvedHitCountByType: { physical: 14, arcane: 6 },
          synergyActivationCountById: { crit_chain: 1 },
          synergyFirstActivatedFloorById: { crit_chain: 3 }
        }
      },
      rngCursor: makeRngCursor()
    },
    session: {
      progressionPromptState: {
        nextPromptDelayMs: 2_100,
        pendingLevelUpSkillOfferIds: ["chain_lightning"]
      },
      comparePromptState: {
        active: { itemId: "loot-0", source: "boss_reward" },
        immediate: [{ itemId: "loot-1", source: "auto_pickup" }],
        deferred: [{ itemId: "loot-2", source: "boss_reward" }],
        drainMode: "all"
      },
      lease: {
        tabId: "tab-a",
        leaseUntilMs: 1_000,
        renewedAtMs: 900
      }
    }
  };
}

describe("save", () => {
  it("round-trips a valid v3 run save", () => {
    const save = makeSave();
    const raw = serializeRunState(save);
    const loaded = deserializeRunState(raw);

    expect(loaded).not.toBeNull();
    expect(loaded?.runId).toBe(save.runId);
    expect(loaded?.runtime.monsters[0]?.nextAttackAt).toBe(300);
    expect(loaded?.runtime.rngCursor.event).toBe(6);
    expect(loaded?.session.comparePromptState).toEqual(save.session.comparePromptState);
  });

  it("returns source version metadata for valid v3 payload", () => {
    const result = deserializeRunStateResult(JSON.stringify(makeSave()));

    expect(result.sourceVersion).toBe(3);
    expect(result.save?.schemaVersion).toBe(3);
  });

  it("rejects invalid save payload", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    delete broken.domain;

    expect(validateSave(broken)).toBe(false);
    expect(deserializeRunState(JSON.stringify(broken))).toBeNull();
  });

  it("rejects invalid runtime nested state", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.runtime = {
      ...(broken.runtime as Record<string, unknown>),
      powerSpikeBudgetState: {
        pairStates: {
          "1-2": { hitCount: 1, majorHitCount: 0, satisfied: true, fallbackGranted: false },
          "3-4": { hitCount: "0", majorHitCount: 0, satisfied: false, fallbackGranted: false },
          "5": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false }
        },
        acceptedSpikeCount: 1,
        majorSpikeCount: 0
      }
    };

    expect(validateSave(broken)).toBe(false);
  });

  it("rejects runtime state when deferred outcomes are missing", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.runtime = {
      ...(broken.runtime as Record<string, unknown>),
      deferredOutcomes: undefined
    };

    expect(validateSave(broken)).toBe(false);
    expect(deserializeRunState(JSON.stringify(broken))).toBeNull();
  });

  it("rejects invalid persistent player shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.domain = {
      ...(broken.domain as Record<string, unknown>),
      player: {
        ...((broken.domain as Record<string, unknown>).player as Record<string, unknown>),
        position: undefined
      }
    };

    expect(validateSave(broken)).toBe(false);
    expect(deserializeRunState(JSON.stringify(broken))).toBeNull();
  });

  it("rejects sparse consumable state", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.domain = {
      ...(broken.domain as Record<string, unknown>),
      consumables: {
        charges: {
          health_potion: 1,
          mana_potion: 1,
          scroll_of_mapping: 0
        },
        cooldowns: {
          health_potion: 0,
          mana_potion: 0,
          scroll_of_mapping: 0
        }
      }
    };

    expect(validateSave(broken)).toBe(false);
    expect(deserializeRunState(JSON.stringify(broken))).toBeNull();
  });

  it("rejects invalid runtime monster shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    const runtime = broken.runtime as Record<string, unknown>;
    const monsters = [...(runtime.monsters as Array<Record<string, unknown>>)];
    monsters[0] = {
      ...monsters[0],
      state: {
        ...((monsters[0]?.state as Record<string, unknown>) ?? {}),
        moveSpeed: undefined
      }
    };
    broken.runtime = {
      ...runtime,
      monsters
    };

    expect(validateSave(broken)).toBe(false);
    expect(deserializeRunState(JSON.stringify(broken))).toBeNull();
  });

  it("rejects invalid session nested state", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.session = {
      ...(broken.session as Record<string, unknown>),
      progressionPromptState: {
        nextPromptDelayMs: "soon",
        pendingLevelUpSkillOfferIds: ["chain_lightning"]
      }
    };

    expect(validateSave(broken)).toBe(false);
  });

  it("preserves unknown top-level fields for forward compatibility", () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    save.futureFeature = {
      foo: 1,
      bar: "baz"
    };

    const loaded = deserializeRunState(JSON.stringify(save));
    expect(loaded).not.toBeNull();
    expect((loaded as Record<string, unknown>).futureFeature).toEqual({
      foo: 1,
      bar: "baz"
    });
  });
});
