import { describe, expect, it, vi } from "vitest";
import { DungeonInputRuntime, type DungeonInputSource } from "../DungeonInputRuntime";

function createSource(): DungeonInputSource {
  return {
    runEnded: false,
    debugCheatsEnabled: false,
    time: { now: 100 },
    tileWidth: 64,
    tileHeight: 32,
    origin: { x: 0, y: 0 },
    dungeon: {},
    player: {
      id: "player",
      position: { x: 0, y: 0 },
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      health: 100,
      mana: 40,
      baseStats: {
        strength: 8,
        dexterity: 8,
        vitality: 8,
        intelligence: 8
      },
      derivedStats: {
        maxHealth: 100,
        maxMana: 40,
        armor: 8,
        attackPower: 10,
        critChance: 0.05,
        attackSpeed: 1,
        moveSpeed: 140
      },
      inventory: [],
      equipment: {},
      gold: 0,
      skills: {
        skillSlots: [],
        cooldowns: {}
      },
      activeBuffs: []
    },
    run: {
      startedAtMs: 0,
      runSeed: "input-test",
      difficulty: "normal",
      difficultyModifier: {
        monsterHealthMultiplier: 1,
        monsterDamageMultiplier: 1,
        affixPolicy: "default",
        soulShardMultiplier: 1
      },
      currentFloor: 1,
      currentBiomeId: "forgotten_catacombs",
      floor: 1,
      floorsCleared: 0,
      kills: 0,
      totalKills: 0,
      lootCollected: 0,
      challengeSuccessCount: 0,
      inEndless: false,
      endlessFloor: 0,
      endlessKills: 0,
      runMode: "normal",
      mutatorActiveIds: [],
      mutatorState: {},
      deferredShardBonus: 0,
      runEconomy: {
        obols: 0,
        spentObols: 0
      }
    },
    path: [{ x: 5, y: 0 }],
    attackTargetId: null,
    manualMoveTarget: null,
    manualMoveTargetFailures: 0,
    nextManualPathReplanAt: 0,
    nextKeyboardMoveInputAt: 0,
    dodgeRuntimeState: {
      readyAtMs: 0,
      iframeUntilMs: 0,
      autoTargetSuppressed: false,
      lastSuccessfulDodgeAtMs: null,
      lastMoveIntentDirection: null,
      lastFacingDirection: { x: 1, y: 0 },
      lastDodgeDirection: null,
      lastDodgeDirectionSource: null,
      lastResult: null
    },
    cursorKeys: {
      left: { isDown: false },
      right: { isDown: true },
      up: { isDown: false },
      down: { isDown: false }
    } as DungeonInputSource["cursorKeys"],
    keyboardBindings: [],
    input: {
      keyboard: {
        on: vi.fn(),
        off: vi.fn(),
        createCursorKeys: vi.fn(() => null)
      },
      activePointer: {
        worldX: 0,
        worldY: 0
      }
    } as unknown as DungeonInputSource["input"],
    debugRuntimeModule: {
      handleHotkey: vi.fn()
    },
    progressionRuntimeModule: {
      revealHiddenRoom: vi.fn()
    },
    entityManager: {
      pickMonsterAt: vi.fn(() => null)
    },
    movementSystem: {
      updatePlayerMovement: vi.fn((player, path) => ({ player, path, moved: false }))
    },
    eventBus: {
      emit: vi.fn()
    },
    runLog: {
      appendKey: vi.fn()
    },
    isBlockingOverlayOpen: vi.fn(() => false),
    getRunRelativeNowMs: vi.fn(() => 100),
    recordPlayerInput: vi.fn(),
    scheduleRunSave: vi.fn(),
    computePathTo: vi.fn(() => [{ x: 1, y: 0 }]),
    tryUseSkill: vi.fn(),
    tryUseConsumable: vi.fn(),
    tryUseDodge: vi.fn(() => true)
  };
}

describe("DungeonInputRuntime", () => {
  it("lets keyboard movement replace an in-flight path immediately", () => {
    const source = createSource();
    const runtime = new DungeonInputRuntime(() => source);

    runtime.updateKeyboardMoveIntent(100);

    expect(source.path).toEqual([{ x: 1, y: 0 }]);
    expect(source.manualMoveTarget).toEqual({ x: 1, y: 0 });
    expect(source.recordPlayerInput).toHaveBeenCalledWith(100);
  });

  it("binds Space to dodge", () => {
    const source = createSource();
    const runtime = new DungeonInputRuntime(() => source);

    runtime.bindSkillKeys();

    expect(source.keyboardBindings.some((binding) => binding.eventName === "keydown-SPACE")).toBe(true);
  });
});
