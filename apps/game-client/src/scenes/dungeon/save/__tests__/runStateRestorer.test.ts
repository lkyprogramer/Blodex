import { describe, expect, it, vi } from "vitest";
import {
  createInitialConsumableState,
  defaultBaseStats,
  deriveStats,
  getDifficultyModifier,
  type RunSaveDataV2
} from "@blodex/core";

vi.mock("phaser", () => ({
  default: {
    Display: {
      Color: {
        IntegerToColor: () => ({
          rgba: "#000000"
        })
      }
    }
  }
}));
import { RunStateRestorer } from "../RunStateRestorer";
import type { RunStateRestoreHost } from "../savePorts";

function createSave(): RunSaveDataV2 {
  const baseStats = defaultBaseStats();
  const derivedStats = deriveStats(baseStats, []);
  return {
    schemaVersion: 2,
    runtimeNowMs: 500,
    savedAtMs: 123,
    appVersion: "test",
    runId: "seed-1:10",
    runSeed: "seed-1",
    run: {
      startedAtMs: 10,
      runSeed: "seed-1",
      difficulty: "normal",
      difficultyModifier: getDifficultyModifier("normal"),
      currentFloor: 2,
      currentBiomeId: "forgotten_catacombs",
      floor: 2,
      floorsCleared: 1,
      kills: 0,
      totalKills: 0,
      lootCollected: 0,
      challengeSuccessCount: 0,
      inEndless: false,
      endlessFloor: 0,
      endlessKills: 0,
      mutatorActiveIds: [],
      mutatorState: {},
      deferredShardBonus: 0,
      runMode: "normal",
      runEconomy: {
        obols: 0,
        spentObols: 0
      }
    },
    player: {
      id: "player-1",
      position: { x: 1, y: 1 },
      level: 1,
      xp: 0,
      xpToNextLevel: 10,
      pendingLevelUpChoices: 0,
      pendingSkillChoices: 1,
      health: 100,
      mana: 40,
      baseStats,
      derivedStats,
      inventory: [],
      equipment: {},
      gold: 0,
      skills: {
        skillSlots: [null, null],
        cooldowns: {}
      },
      activeBuffs: [
        {
          defId: "war_cry",
          sourceId: "player-1",
          targetId: "player-1",
          appliedAtMs: 100,
          expiresAtMs: 1000
        }
      ]
    },
    consumables: createInitialConsumableState(0),
    dungeon: {
      width: 4,
      height: 4,
      walkable: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => true)),
      rooms: [],
      corridors: [],
      spawnPoints: [{ x: 1, y: 1 }],
      playerSpawn: { x: 1, y: 1 },
      layoutHash: "layout-1"
    },
    staircase: {
      position: { x: 3, y: 3 },
      visible: false
    },
    hazards: [],
    boss: null,
    monsters: [
      {
        state: {
          id: "monster-1",
          archetypeId: "melee_grunt",
          level: 2,
          health: 30,
          maxHealth: 30,
          damage: 8,
          attackRange: 1.5,
          moveSpeed: 64,
          xpValue: 4,
          dropTableId: "starter_floor",
          position: { x: 2, y: 2 },
          aiState: "attack",
          aiBehavior: "chase",
          activeBuffs: [
            {
              defId: "frost_slow",
              sourceId: "player-1",
              targetId: "monster-1",
              appliedAtMs: 100,
              expiresAtMs: 1000
            }
          ]
        },
        baseMoveSpeed: 128,
        nextAttackAt: 250,
        nextSupportAt: 0
      }
    ],
    lootOnGround: [],
    eventNode: null,
    minimap: {
      layoutHash: "layout-1",
      exploredKeys: []
    },
    mapRevealActive: false,
    rngCursor: {
      procgen: 0,
      spawn: 0,
      combat: 0,
      loot: 0,
      skill: 0,
      boss: 0,
      biome: 0,
      hazard: 0,
      event: 0,
      merchant: 0
    },
    selectedMutationIds: [],
    blueprintFoundIdsInRun: [],
    deferredOutcomes: [],
    progressionPromptState: {
      nextPromptDelayMs: 2_100,
      pendingLevelUpSkillOfferIds: ["chain_lightning"]
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
      startedAtMs: 10,
      buildFormedState: false,
      inputTimestampsMs: [],
      story: {
        playerFacingChoices: 0,
        choiceCountByFloor: {},
        powerSpikes: 0,
        majorPowerSpikes: 0,
        buildFormed: 0,
        rareDropsPresented: 0,
        bossRewardClosed: 0
      },
      combat: {
        skillUses: 0,
        skillCastsPer30s: 0,
        skillDamage: 0,
        autoAttackDamage: 0,
        skillDamageShare: 0,
        autoAttackDamageShare: 0,
        manaDryWindowMs: 0,
        averageNoInputGapMs: 0,
        maxNoInputGapMs: 0
      },
      runtimeEffects: {
        buffApplyCountById: {},
        buffUptimeMsById: {},
        damageDealtByType: {},
        damageTakenByType: {},
        resolvedHitCountByType: {},
        synergyActivationCountById: {},
        synergyFirstActivatedFloorById: {}
      }
    }
  };
}

function createExpiredMonsterSlowSave(): RunSaveDataV2 {
  const save = createSave();
  return {
    ...save,
    runtimeNowMs: 1_200,
    monsters: save.monsters.map((monster) => ({
      ...monster,
      state: {
        ...monster.state,
        activeBuffs: [
          {
            defId: "frost_slow",
            sourceId: "player-1",
            targetId: monster.state.id,
            appliedAtMs: 100,
            expiresAtMs: 1_000
          }
        ]
      }
    }))
  };
}

function createHost(): RunStateRestoreHost {
  return {
    pendingResumeSave: null,
    time: {
      now: 600
    },
    meta: {
      selectedMutationIds: [],
      mutationSlots: 1
    },
    syncEndlessMutators: vi.fn(),
    resolveDailyWeaponType: vi.fn(() => null),
    entityLabelById: new Map(),
    newlyAcquiredItemUntilMs: new Map(),
    previousSkillCooldownLeftById: new Map(),
    skillReadyFlashUntilMsById: new Map(),
    statHighlightEntries: [],
    uiManager: {
      clearLogs: vi.fn(),
      hideDeathOverlay: vi.fn(),
      hideEventPanel: vi.fn(),
      configureMinimap: vi.fn(),
      resetMinimap: vi.fn(),
      restoreMinimap: vi.fn()
    },
    refreshUnlockSnapshots: vi.fn(),
    children: {
      removeAll: vi.fn()
    },
    entityManager: {
      clear: vi.fn(),
      setMonsters: vi.fn(),
      setBoss: vi.fn()
    },
    hazardRuntimeModule: {
      clearHazards: vi.fn(),
      restoreHazards: vi.fn()
    },
    progressionRuntimeModule: {
      clearChallengeState: vi.fn(),
      renderHiddenRoomMarkers: vi.fn(),
      renderStaircases: vi.fn(),
      restoreChallengeRoom: vi.fn()
    },
    movementSystem: {
      clearPathCache: vi.fn()
    },
    configureRngStreams: vi.fn(),
    renderSystem: {
      computeWorldBounds: vi.fn(() => ({
        origin: { x: 0, y: 0 },
        worldBounds: { x: 0, y: 0, width: 100, height: 100 }
      })),
      drawDungeon: vi.fn(),
      spawnPlayer: vi.fn(() => ({
        sprite: {},
        yOffset: 0
      })),
      spawnMonster: vi.fn((state) => ({
        state,
        baseMoveSpeed: state.moveSpeed,
        sprite: {},
        healthBarBg: {},
        healthBarFg: {},
        affixMarker: undefined,
        healthBarYOffset: 0,
        yOffset: 0,
        nextAttackAt: 0,
        nextSupportAt: 0
      })),
      configureCamera: vi.fn()
    },
    cameras: {
      main: {
        setBackgroundColor: vi.fn()
      }
    },
    refreshPlayerStatsFromEquipment: vi.fn((player) => player),
    eventRuntimeModule: {
      destroyEventNode: vi.fn()
    },
    restorePhase6TelemetryState: vi.fn(),
    sfxSystem: {
      playAmbientForBiome: vi.fn()
    },
    updateMinimap: vi.fn(),
    resetMutationRuntimeState: vi.fn(),
    refreshSynergyRuntime: vi.fn(),
    restorePowerSpikeBudgetState: vi.fn(),
    restoreProgressionPromptState: vi.fn(),
    resetFloorChoiceBudget: vi.fn(),
    floorConfig: null,
    currentBiome: null
  } as unknown as RunStateRestoreHost;
}

describe("RunStateRestorer", () => {
  it("rebuilds synergy runtime without replaying activation events", () => {
    const host = createHost();
    const restorer = new RunStateRestorer({
      host
    });

    const restored = restorer.restore(createSave());

    expect(restored).toBe(true);
    expect(host.refreshSynergyRuntime).toHaveBeenCalledWith(false, {
      emitActivationEvents: false,
      recordTelemetry: false
    });
    expect(host.restoreProgressionPromptState).toHaveBeenCalledWith(
      {
        nextPromptDelayMs: 2_100,
        pendingLevelUpSkillOfferIds: ["chain_lightning"]
      },
      600
    );
    expect(host.restorePowerSpikeBudgetState).toHaveBeenCalledWith({
      pairStates: {
        "1-2": { hitCount: 1, majorHitCount: 0, satisfied: true, fallbackGranted: false },
        "3-4": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false },
        "5": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false }
      },
      acceptedSpikeCount: 1,
      majorSpikeCount: 0
    });
  });

  it("restores monster baseMoveSpeed separately from current slowed moveSpeed", () => {
    const host = createHost();
    const restorer = new RunStateRestorer({
      host
    });

    const restored = restorer.restore(createSave());

    expect(restored).toBe(true);
    const restoredMonsters = vi.mocked(host.entityManager.setMonsters).mock.calls[0]?.[0] ?? [];
    expect(restoredMonsters[0]?.baseMoveSpeed).toBe(128);
    expect(restoredMonsters[0]?.state.moveSpeed).toBe(64);
    expect(restoredMonsters[0]?.state.activeBuffs?.[0]?.appliedAtMs).toBe(200);
    expect(restoredMonsters[0]?.state.activeBuffs?.[0]?.expiresAtMs).toBe(1100);
    expect(host.player.activeBuffs?.[0]?.appliedAtMs).toBe(200);
    expect(host.player.activeBuffs?.[0]?.expiresAtMs).toBe(1100);
  });

  it("does not preserve expired slow when rebuilding restored moveSpeed", () => {
    const host = createHost();
    const restorer = new RunStateRestorer({
      host
    });

    const restored = restorer.restore(createExpiredMonsterSlowSave());

    expect(restored).toBe(true);
    const restoredMonsters = vi.mocked(host.entityManager.setMonsters).mock.calls[0]?.[0] ?? [];
    expect(restoredMonsters[0]?.state.activeBuffs).toEqual([]);
    expect(restoredMonsters[0]?.baseMoveSpeed).toBe(128);
    expect(restoredMonsters[0]?.state.moveSpeed).toBe(128);
  });
});
