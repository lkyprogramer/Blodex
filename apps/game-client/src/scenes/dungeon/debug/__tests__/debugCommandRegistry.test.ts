import { describe, expect, it, vi } from "vitest";
import { createRunState } from "@blodex/core";
import type { DebugCommandHost } from "../ports";
import { DebugCommandRegistry } from "../DebugCommandRegistry";

vi.mock("phaser", () => ({
  default: {
    GameObjects: {
      Image: class Image {},
      Ellipse: class Ellipse {}
    }
  }
}));

function createHost(): DebugCommandHost {
  return {
    collectDiagnosticsSnapshot: vi.fn(() => ({})),
    entityManager: {
      getDiagnostics: vi.fn(() => ({ monsters: 0, livingMonsters: 0, loot: 0 })),
      listLivingMonsters: vi.fn(() => []),
      removeMonsterById: vi.fn(() => null)
    },
    eventBus: {
      listenerCount: vi.fn(() => 0),
      emit: vi.fn()
    },
    bootstrapRun: vi.fn(),
    time: { now: 1_000 },
    selectedDifficulty: "normal",
    hudDirty: false,
    runEnded: false,
    run: createRunState("debug-seed", 0, "normal"),
    runSeed: "debug-seed",
    consumables: {
      charges: {
        health_potion: 0,
        mana_potion: 0,
        scroll_of_mapping: 0,
        scroll_of_mapping_plus: 0,
        frenzy_tonic: 0,
        phantom_brew: 0
      },
      cooldowns: {
        health_potion: 0,
        mana_potion: 0,
        scroll_of_mapping: 0,
        scroll_of_mapping_plus: 0,
        frenzy_tonic: 0,
        phantom_brew: 0
      }
    },
    floorConfig: {
      floorNumber: 1,
      monsterHpMultiplier: 1,
      monsterDmgMultiplier: 1,
      monsterCount: 12,
      clearThreshold: 0.7,
      isBossFloor: false
    },
    eventPanelOpen: false,
    eventRuntimeModule: {
      consumeCurrentEvent: vi.fn(),
      createEventNode: vi.fn(),
      openEventPanel: vi.fn(),
      openMerchantPanel: vi.fn()
    },
    pickFloorEventPosition: vi.fn(() => null),
    dungeon: {
      width: 1,
      height: 1,
      walkable: [[true]],
      rooms: [],
      corridors: [],
      spawnPoints: [],
      playerSpawn: { x: 0, y: 0 },
      layoutHash: "debug-layout"
    },
    eventRng: {
      next: vi.fn(() => 0),
      nextInt: vi.fn(() => 0),
      pick: vi.fn(<T>(items: T[]) => items[0]!)
    },
    progressionRuntimeModule: {
      removeChallengeMonsters: vi.fn(),
      clearChallengeState: vi.fn(),
      resolveChallengeWaveTotal: vi.fn(() => 2),
      challengeRoomCenter: vi.fn(() => null),
      startChallengeEncounter: vi.fn(),
      finishChallengeEncounter: vi.fn(),
      onMonsterDefeated: vi.fn(),
      renderStaircases: vi.fn(),
      setupFloor: vi.fn()
    },
    challengeRoomState: null,
    challengeWaveTotal: 0,
    challengeMarker: null,
    renderSystem: {
      spawnTelegraphCircle: vi.fn()
    },
    origin: { x: 0, y: 0 },
    scheduleRunSave: vi.fn(),
    flushRunSave: vi.fn(),
    bossState: null,
    bossRuntimeModule: {
      openVictoryChoice: vi.fn()
    },
    runCompletionModule: {
      enterAbyss: vi.fn(),
      finishRun: vi.fn()
    },
    getRunRelativeNowMs: vi.fn(() => 250),
    syncEndlessMutators: vi.fn(),
    deferredOutcomeRuntime: {
      settle: vi.fn()
    },
    refreshPlayerStatsFromEquipment: vi.fn((player) => player),
    player: {
      id: "player",
      position: { x: 0, y: 0 },
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      pendingLevelUpChoices: 0,
      pendingSkillChoices: 0,
      health: 100,
      mana: 50,
      baseStats: { strength: 8, dexterity: 8, vitality: 8, intelligence: 5 },
      derivedStats: {
        maxHealth: 100,
        maxMana: 50,
        armor: 0,
        attackPower: 10,
        critChance: 0,
        attackSpeed: 1,
        moveSpeed: 160
      },
      inventory: [],
      equipment: {},
      gold: 0,
      skills: { skillSlots: [], cooldowns: {} },
      activeBuffs: []
    },
    handleLevelUpGain: vi.fn(),
    lootRng: {
      next: vi.fn(() => 0),
      nextInt: vi.fn(() => 0),
      pick: vi.fn(<T>(items: T[]) => items[0]!)
    },
    resolveLootRollOptions: vi.fn((options) => options),
    isItemDefUnlocked: vi.fn(() => true),
    spawnLootDrop: vi.fn(),
    staircaseState: {
      kind: "single",
      position: { x: 0, y: 0 },
      visible: false
    },
    tryDiscoverBlueprints: vi.fn(),
    uiManager: {
      clearSummary: vi.fn(),
      hideDeathOverlay: vi.fn()
    },
    lastDeathReason: "",
    synergyRuntime: {
      activeSynergyIds: []
    },
    refreshSynergyRuntime: vi.fn(),
    currentBiome: { id: "forgotten_catacombs" },
    runLog: {
      debug: vi.fn()
    }
  } as unknown as DebugCommandHost;
}

describe("DebugCommandRegistry", () => {
  it("allows jumping into endless floors for white-box validation", () => {
    const host = createHost();
    const registry = new DebugCommandRegistry(host);

    registry.jumpFloor(9);

    expect(host.run.currentFloor).toBe(9);
    expect(host.run.inEndless).toBe(true);
    expect(host.run.endlessFloor).toBe(1);
    expect(host.syncEndlessMutators).toHaveBeenCalledOnce();
    expect(host.progressionRuntimeModule.setupFloor).toHaveBeenCalledWith(9, false);
  });
});
