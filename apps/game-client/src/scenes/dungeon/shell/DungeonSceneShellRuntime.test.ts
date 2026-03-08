import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DifficultyMode, MetaProgression, PlayerState } from "@blodex/core";
import { initializeDungeonSceneShell, type DungeonSceneShellSource } from "./DungeonSceneShellRuntime";

vi.mock("phaser", () => ({
  default: {
    Scenes: {
      Events: {
        SHUTDOWN: "shutdown",
        DESTROY: "destroy"
      }
    }
  }
}));

vi.mock("../../../ui/UIManager", () => ({
  UIManager: class {
    appendLog = vi.fn();
    reset = vi.fn();
    clearLogs = vi.fn();
    hideEventPanel = vi.fn();
    hideDeathOverlay = vi.fn();
  }
}));

vi.mock("../encounter/BossRuntimeModule", () => ({
  BossRuntimeModule: class {
    updateCombat = vi.fn();
    syncSprite = vi.fn();
    openVictoryChoice = vi.fn();
  }
}));

vi.mock("../encounter/BossCombatService", () => ({
  BossCombatService: class {
    constructor(_: unknown) {}
  }
}));

vi.mock("../encounter/BossSpawnService", () => ({
  BossSpawnService: class {
    constructor(_: unknown) {}
  }
}));

vi.mock("../encounter/BossTelegraphPresenter", () => ({
  BossTelegraphPresenter: class {
    constructor(_: unknown) {}
  }
}));

vi.mock("../encounter/EncounterController", () => ({
  EncounterController: class {
    updateCombat = vi.fn();
    updateMonsters = vi.fn();
    updateMonsterCombat = vi.fn();
    updateBossCombat = vi.fn();
    updateChallenge = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../encounter/PlayerActionModule", () => ({
  PlayerActionModule: class {
    tryUseSkill = vi.fn();
    tryUseConsumable = vi.fn();
    resetRuntimeState = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../run/RunCompletionModule", () => ({
  RunCompletionModule: class {
    finishRun = vi.fn();
    resetRun = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../run/resolveInitialRunSeed", () => ({
  resolveInitialRunSeed: vi.fn(() => "test-seed")
}));

vi.mock("../save/RunPersistenceModule", () => ({
  RunPersistenceModule: class {
    buildSnapshot = vi.fn();
    restore = vi.fn(() => false);
    flush = vi.fn();
    schedule = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../save/SaveCoordinator", () => ({
  SaveCoordinator: class {
    bindPageLifecycle = vi.fn();
    startHeartbeat = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/EventResolutionService", () => ({
  EventResolutionService: class {
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/EventRuntimeModule", () => ({
  EventRuntimeModule: class {
    updateInteraction = vi.fn();
    destroyEventNode = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/FloorProgressionModule", () => ({
  FloorProgressionModule: class {
    update = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/MerchantFlowService", () => ({
  MerchantFlowService: class {
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/ProgressionRuntimeModule", () => ({
  ProgressionRuntimeModule: class {
    updateChallengeRoom = vi.fn();
    revealNearbyHiddenRoomsByMutation = vi.fn();
    setupFloor = vi.fn();
    onMonsterDefeated = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/HazardRuntimeModule", () => ({
  HazardRuntimeModule: class {
    updateHazards = vi.fn();
    resolvePlayerHazardMovementMultiplier = vi.fn(() => 1);
    constructor(_: unknown) {}
  }
}));

vi.mock("../world/WorldEventController", () => ({
  WorldEventController: class {
    updatePreResolution = vi.fn();
    updatePostResolution = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../debug/DebugRuntimeModule", () => ({
  DebugRuntimeModule: class {
    install = vi.fn();
    constructor(_: unknown) {}
  }
}));

vi.mock("../logging/DomainEventEffectBinder", () => ({
  bindDomainEventEffects: vi.fn(),
  createDomainEventEffectHost: vi.fn((host) => host)
}));

function createMeta(): MetaProgression {
  return {
    selectedDifficulty: "normal",
    preferredLocale: null,
    talentPoints: {},
    blueprintForgedIds: [],
    unlocks: []
  } as unknown as MetaProgression;
}

function createPlayer(): PlayerState {
  return {
    id: "player-1",
    level: 1,
    xp: 0,
    xpToNext: 10,
    health: 100,
    mana: 50,
    position: { x: 1, y: 1 },
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    derivedStats: {
      attackPower: 10,
      armor: 0,
      critChance: 0,
      critDamage: 1.5,
      attackSpeed: 1,
      maxHealth: 100,
      maxMana: 50,
      moveSpeed: 4,
      soulShardMultiplier: 1,
      obolMultiplier: 1,
      skillBonusDamage: 0
    },
    inventory: [],
    equipment: {},
    skills: { skillSlots: [] },
    activeBuffs: [],
    potions: { health: 1, mana: 1 }
  } as unknown as PlayerState;
}

describe("initializeDungeonSceneShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bootstraps a fresh run without relying on readonly bridge writes", () => {
    const loadedMeta = {
      ...createMeta(),
      selectedDifficulty: "hard"
    } satisfies MetaProgression;
    let metaState = createMeta();
    const replaceMeta = vi.fn((next: MetaProgression) => {
      metaState = next;
    });
    const bootstrapRun = vi.fn();
    const flushRunSave = vi.fn();
    const normalizeMetaForPhase4B = vi.fn(() => {
      expect(metaState).toBe(loadedMeta);
    });
    const source = {
      cleanupStarted: true,
      preserveSceneTransitionOnCleanup: true,
      debugCheatsEnabled: false,
      diagnosticsEnabled: false,
      pendingResumeSave: null,
      selectedDifficulty: "normal" as DifficultyMode,
      player: createPlayer(),
      uiManager: null as unknown as DungeonSceneShellSource["uiManager"],
      saveCoordinator: null as unknown as DungeonSceneShellSource["saveCoordinator"],
      runPersistenceModule: null as unknown as DungeonSceneShellSource["runPersistenceModule"],
      eventRuntimeModule: null as unknown as DungeonSceneShellSource["eventRuntimeModule"],
      bossRuntimeModule: null as unknown as DungeonSceneShellSource["bossRuntimeModule"],
      runCompletionModule: null as unknown as DungeonSceneShellSource["runCompletionModule"],
      hazardRuntimeModule: null as unknown as DungeonSceneShellSource["hazardRuntimeModule"],
      progressionRuntimeModule: null as unknown as DungeonSceneShellSource["progressionRuntimeModule"],
      floorProgressionModule: null as unknown as DungeonSceneShellSource["floorProgressionModule"],
      playerActionModule: null as unknown as DungeonSceneShellSource["playerActionModule"],
      encounterController: null as unknown as DungeonSceneShellSource["encounterController"],
      worldEventController: null as unknown as DungeonSceneShellSource["worldEventController"],
      debugRuntimeModule: null as unknown as DungeonSceneShellSource["debugRuntimeModule"],
      combatRuntime: {
        updateCombat: vi.fn(),
        updateMonsters: vi.fn(),
        updateMonsterCombat: vi.fn(),
        collectNearbyLoot: vi.fn()
      },
      metaRuntime: {
        loadMeta: vi.fn(() => loadedMeta),
        refreshTalentEffects: vi.fn(),
        resolveSelectedDifficultyForRun: vi.fn(() => "normal")
      },
      runEnded: false,
      pendingRunSeed: undefined,
      lastAutoSaveAt: 0,
      hudDirty: false,
      time: { now: 1234 },
      runLog: {
        appendKey: vi.fn(),
        setSink: vi.fn()
      },
      eventBus: { emit: vi.fn() },
      dungeonSceneHostBridge: {} as DungeonSceneShellSource["dungeonSceneHostBridge"],
      sfxSystem: {
        setEnabled: vi.fn(),
        initialize: vi.fn(),
        stopAmbient: vi.fn()
      },
      vfxSystem: {
        setEnabled: vi.fn()
      },
      saveManager: {} as DungeonSceneShellSource["saveManager"],
      runSaveSnapshotBuilder: {} as DungeonSceneShellSource["runSaveSnapshotBuilder"],
      runStateRestorer: {} as DungeonSceneShellSource["runStateRestorer"],
      debugApiBinder: {} as DungeonSceneShellSource["debugApiBinder"],
      debugCommandRegistry: {} as DungeonSceneShellSource["debugCommandRegistry"],
      contentLocalizer: {
        itemName: (_id: string, fallback: string) => fallback
      },
      replaceMeta,
      resolveLocalePreference: vi.fn(),
      normalizeMetaForPhase4B,
      refreshPlayerStatsFromEquipment: vi.fn((player: PlayerState) => player),
      registerStatDeltaHighlights: vi.fn(),
      refreshSynergyRuntime: vi.fn(),
      scheduleRunSave: vi.fn(),
      tryUseConsumable: vi.fn(),
      updateMinimap: vi.fn(),
      applyRuntimeBackgroundRemoval: vi.fn(),
      initDiagnosticsPanel: vi.fn(),
      bootstrapRun,
      flushRunSave,
      renderDiagnosticsPanel: vi.fn(),
      handlePointerDown: vi.fn(),
      inputRuntime: {
        clearKeyboardBindings: vi.fn(),
        bindSkillKeys: vi.fn(),
        bindMovementKeys: vi.fn()
      },
      cleanupScene: vi.fn()
    } as unknown as DungeonSceneShellSource;

    const scene = {
      cameras: {
        main: { setBackgroundColor: vi.fn() }
      },
      input: { on: vi.fn() },
      events: { once: vi.fn() },
      createShellRuntimeSource: () => source
    } as unknown as import("../../DungeonScene").DungeonScene;

    expect(() => initializeDungeonSceneShell(scene)).not.toThrow();
    expect(replaceMeta).toHaveBeenCalledTimes(1);
    expect(replaceMeta).toHaveBeenCalledWith(loadedMeta);
    expect(metaState).toBe(loadedMeta);
    expect(source.metaRuntime.loadMeta).toHaveBeenCalledTimes(1);
    expect(source.metaRuntime.refreshTalentEffects).toHaveBeenCalledTimes(1);
    expect(normalizeMetaForPhase4B).toHaveBeenCalledTimes(1);
    expect(source.uiManager).not.toBeNull();
    expect(source.saveCoordinator).not.toBeNull();
    expect(source.runPersistenceModule).not.toBeNull();
    expect(bootstrapRun).toHaveBeenCalledWith("test-seed", "normal");
    expect(flushRunSave).toHaveBeenCalledTimes(1);
    expect(source.inputRuntime.bindSkillKeys).toHaveBeenCalledTimes(1);
    expect(source.inputRuntime.bindMovementKeys).toHaveBeenCalledTimes(1);
  });
});
