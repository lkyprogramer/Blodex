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
import { defaultBaseStats, deriveStats } from "../stats";
import type { RunState } from "../run";
import {
  deserializeRunState,
  deserializeRunStateResult,
  migrateRunSaveV1ToV2,
  serializeRunState,
  validateSave,
  type RunSaveDataV1,
  type RunSaveDataV2
} from "../save";

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

function makeSave(): RunSaveDataV2 {
  return {
    schemaVersion: 2,
    runtimeNowMs: 260,
    savedAtMs: 123,
    appVersion: "test",
    runId: "seed-1:100",
    runSeed: "seed-1",
    run: makeRunState(),
    player: makePlayer(),
    consumables: createInitialConsumableState(0),
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
        state: makeMonsterState(),
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
    rngCursor: makeRngCursor(),
    blueprintFoundIdsInRun: ["bp_1"],
    selectedMutationIds: ["mut_1"],
    progressionPromptState: {
      nextPromptDelayMs: 2_100,
      pendingLevelUpSkillOfferIds: ["chain_lightning"]
    },
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
    lease: {
      tabId: "tab-a",
      leaseUntilMs: 1000,
      renewedAtMs: 900
    }
  };
}

function toV1(save: RunSaveDataV2): RunSaveDataV1 {
  const {
    challengeSuccessCount,
    inEndless,
    endlessFloor,
    runMode,
    mutatorActiveIds,
    mutatorState,
    deferredShardBonus,
    ...legacyRun
  } = save.run;
  void challengeSuccessCount;
  void inEndless;
  void endlessFloor;
  void runMode;
  void mutatorActiveIds;
  void mutatorState;
  void deferredShardBonus;
  return {
    ...save,
    schemaVersion: 1,
    run: legacyRun,
    staircase: {
      position: { ...save.staircase.position },
      visible: save.staircase.visible
    }
  };
}

describe("save", () => {
  it("round-trips a valid run save", () => {
    const save = makeSave();
    const raw = serializeRunState(save);
    const loaded = deserializeRunState(raw);

    expect(loaded).not.toBeNull();
    expect(loaded?.runId).toBe(save.runId);
    expect(loaded?.runtimeNowMs).toBe(260);
    expect(loaded?.monsters[0]?.nextAttackAt).toBe(300);
    expect(loaded?.rngCursor.event).toBe(6);
  });

  it("normalizes legacy draft fields on deserialize", () => {
    const save = toV1(makeSave()) as unknown as Record<string, unknown>;
    delete save.blueprintFoundIdsInRun;
    delete save.selectedMutationIds;
    save.blueprintsFoundThisRun = ["bp_legacy"];
    save.selectedMutations = ["mut_legacy"];

    const loaded = deserializeRunState(JSON.stringify(save));

    expect(loaded?.blueprintFoundIdsInRun).toEqual(["bp_legacy"]);
    expect(loaded?.selectedMutationIds).toEqual(["mut_legacy"]);
    expect("blueprintsFoundThisRun" in (loaded ?? {})).toBe(false);
    expect("selectedMutations" in (loaded ?? {})).toBe(false);
  });

  it("migrates v1 payload into v2 shape", () => {
    const saveV1 = toV1(makeSave());
    const migratedByDeserializer = deserializeRunState(JSON.stringify(saveV1));
    const migratedByHelper = migrateRunSaveV1ToV2(saveV1);

    expect(migratedByDeserializer?.schemaVersion).toBe(2);
    expect(migratedByDeserializer?.run.runMode).toBe("normal");
    expect(migratedByDeserializer?.run.inEndless).toBe(false);
    expect(migratedByDeserializer?.deferredOutcomes).toEqual([]);
    expect(migratedByDeserializer).toEqual(migratedByHelper);
  });

  it("returns source version metadata for v1 migration", () => {
    const saveV1 = toV1(makeSave());
    const result = deserializeRunStateResult(JSON.stringify(saveV1));
    expect(result.sourceVersion).toBe(1);
    expect(result.migratedFromV1).toBe(true);
    expect(result.save?.schemaVersion).toBe(2);
  });

  it("rejects invalid save payload", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    delete broken.run;

    expect(validateSave(broken)).toBe(false);
    expect(deserializeRunState(JSON.stringify(broken))).toBeNull();
  });

  it("rejects invalid hidden room snapshot shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    const dungeon = broken.dungeon as Record<string, unknown>;
    dungeon.hiddenRooms = [
      {
        roomId: "hidden-1",
        entrance: { x: 2, y: 2 },
        revealed: "nope"
      }
    ];

    expect(validateSave(broken)).toBe(false);
  });

  it("round-trips optional floor choice budget snapshot", () => {
    const save = makeSave();
    save.floorChoiceBudget = {
      floor: 3,
      satisfied: true,
      source: "event"
    };
    const loaded = deserializeRunState(serializeRunState(save));

    expect(loaded).not.toBeNull();
    expect(loaded?.floorChoiceBudget).toEqual({
      floor: 3,
      satisfied: true,
      source: "event"
    });
  });

  it("round-trips progression prompt state", () => {
    const save = makeSave();
    const loaded = deserializeRunState(serializeRunState(save));

    expect(loaded?.progressionPromptState).toEqual(save.progressionPromptState);
  });

  it("round-trips phase6 telemetry runtime state", () => {
    const save = makeSave();
    const loaded = deserializeRunState(serializeRunState(save));

    expect(loaded?.phase6TelemetryState).toEqual(save.phase6TelemetryState);
  });

  it("rejects invalid floor choice budget snapshot shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.floorChoiceBudget = {
      floor: "3",
      satisfied: true
    };

    expect(validateSave(broken)).toBe(false);
  });

  it("rejects invalid phase6 telemetry runtime state shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.phase6TelemetryState = {
      startedAtMs: 100,
      buildFormedState: "yes",
      inputTimestampsMs: [],
      story: {},
      combat: {},
      runtimeEffects: {}
    };

    expect(validateSave(broken)).toBe(false);
  });

  it("rejects invalid progression prompt state shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.progressionPromptState = {
      nextPromptDelayMs: "soon",
      pendingLevelUpSkillOfferIds: ["chain_lightning"]
    };

    expect(validateSave(broken)).toBe(false);
  });

  it("rejects invalid runtime clock shape", () => {
    const broken = makeSave() as unknown as Record<string, unknown>;
    broken.runtimeNowMs = "260";

    expect(validateSave(broken)).toBe(false);
  });

  it("keeps unknown fields for forward compatibility", () => {
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
